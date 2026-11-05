import type { Usage } from "core";
import {
  findAnthropicPricing,
  type ModelPricing,
} from "core/llm/utils/calculateRequestCost";
import { minCacheableTokens } from "core/llm/utils/cacheMinimums";
import {
  AUTO_ESCALATE_AT_REQUEST,
  AUTO_ESCALATE_MAX_GAP_MS,
  AUTO_ESCALATE_MIN_GAP_MS,
  isAgentStyleMode,
  PROMPT_CACHE_TTL_MS,
} from "./promptCache";

/**
 * One request's cache facts, kept in memory for the session only. Counts and
 * timings, no message content. Everything the tips say about the session is a
 * pure function of a list of these.
 */
export interface CacheLedgerEntry {
  /** When the request started (ms since epoch). */
  at: number;
  mode?: string;
  provider: string;
  model: string;
  /** Whether the request carried cache breakpoints. */
  cachingOn: boolean;
  /** Lifetime the request asked for; undefined when caching was off. */
  ttl?: "5m" | "1h";
  /** Whether this model can take a 1-hour lifetime at all. */
  oneHour: boolean;
  /** Input tokens that were neither read from nor written to the cache. */
  uncached: number;
  read: number;
  write5m: number;
  write1h: number;
  output: number;
  /** The oldest messages were dropped to fit, which moves the prompt's start. */
  pruned?: boolean;
  /** Why a cache that should have been read was not; [] when unknown. */
  missCauses?: string[];
  /** Why generation stopped, when the provider said (`tool_use`, `end_turn`...). */
  stopReason?: string;
  /** The provider's own timing for the request, when it sent one. */
  latencyMs?: number;
  /** The call's ID in the provider's logs; ties an entry to a billing line. */
  requestId?: string;
}

export const LEDGER_MAX = 200;

/** All input tokens of the request as the API counted them. */
export function entryInputTokens(e: CacheLedgerEntry): number {
  return e.uncached + e.read + e.write5m + e.write1h;
}

export function buildLedgerEntry(args: {
  at: number;
  mode?: string;
  provider: string;
  model: string;
  cachingOn: boolean;
  ttl?: "5m" | "1h";
  oneHour: boolean;
  /** For Claude, `promptTokens` leaves out cache reads and writes. */
  usage: Usage;
  pruned?: boolean;
  missCauses?: string[];
}): CacheLedgerEntry {
  const d = args.usage.promptTokensDetails;
  const write = d?.cacheWriteTokens ?? 0;
  // When the provider does not split writes by lifetime, they are 5-minute.
  const write1h = Math.min(d?.cacheWriteTokens1h ?? 0, write);
  return {
    at: args.at,
    mode: args.mode,
    provider: args.provider,
    model: args.model,
    cachingOn: args.cachingOn,
    ttl: args.cachingOn ? args.ttl : undefined,
    oneHour: args.oneHour,
    uncached: args.usage.promptTokens,
    read: d?.cachedTokens ?? 0,
    write5m: write - write1h,
    write1h,
    output: args.usage.completionTokens,
    ...(args.pruned && { pruned: true }),
    ...(args.missCauses && { missCauses: args.missCauses }),
    ...(args.usage.response?.stopReason && {
      stopReason: args.usage.response.stopReason,
    }),
    ...(args.usage.response?.latencyMs !== undefined && {
      latencyMs: args.usage.response.latencyMs,
    }),
    ...(args.usage.response?.requestId && {
      requestId: args.usage.response.requestId,
    }),
  };
}

export function appendLedger(
  ledger: CacheLedgerEntry[] | undefined,
  entry: CacheLedgerEntry,
): CacheLedgerEntry[] {
  const next = [...(ledger ?? []), entry];
  return next.length > LEDGER_MAX ? next.slice(-LEDGER_MAX) : next;
}

export type ReplayPolicy = "off" | "5m" | "1h" | "auto";
export const REPLAY_POLICIES: ReplayPolicy[] = ["off", "5m", "1h", "auto"];

const PER = 1_000_000;

function writePrice(p: ModelPricing, ttl: "5m" | "1h"): number {
  return ttl === "1h" ? p.cacheWrite1h : p.cacheWrite;
}

function pricingFor(e: CacheLedgerEntry): ModelPricing | null {
  return findAnthropicPricing(e.model, entryInputTokens(e));
}

/** What the input side of these requests cost, from the tokens recorded. */
export function actualInputCost(
  entries: CacheLedgerEntry[],
): number | undefined {
  let usd = 0;
  for (const e of entries) {
    const p = pricingFor(e);
    if (!p) return undefined;
    usd +=
      (e.uncached * p.input +
        e.read * p.cacheRead +
        e.write5m * p.cacheWrite +
        e.write1h * p.cacheWrite1h) /
      PER;
  }
  return usd;
}

type Chosen = "off" | "5m" | "1h";

/** The lifetime (or off) each request in the ledger actually used. */
function actualChoice(e: CacheLedgerEntry): Chosen {
  return e.cachingOn ? (e.ttl ?? "5m") : "off";
}

/**
 * What the input side of the session would have cost under a policy, replaying
 * the recorded sizes and timings. A request reads the previous request's whole
 * prompt when that entry is still alive (the gap since the previous request
 * started is within its lifetime, a read refreshing it), and writes the rest.
 * Anything that moved the start of the prompt (the model, the tools, a rule,
 * pruning) breaks the chain under every policy, because it did in reality.
 * A prompt under the model's cache minimum is not cached at all.
 *
 * `"actual"` replays what was really chosen, to compare against the cost
 * computed from the recorded tokens: if they differ a lot, the replay is not
 * to be trusted for this session.
 *
 * Returns undefined when a model in the ledger has no price.
 */
export function replayInputCost(
  entries: CacheLedgerEntry[],
  policy: ReplayPolicy | "actual",
): number | undefined {
  let usd = 0;
  let prev: { e: CacheLedgerEntry; total: number; ttl: Chosen } | undefined;
  let escalated = false;
  let counted = 0;

  for (const e of entries) {
    const total = entryInputTokens(e);
    const p = pricingFor(e);
    if (!p) return undefined;

    // The lifetime this policy would have asked for on this request
    let choice: Chosen;
    if (policy === "actual") {
      choice = actualChoice(e);
    } else if (policy === "off") {
      choice = "off";
    } else if (policy === "5m") {
      choice = "5m";
    } else if (policy === "1h") {
      choice = e.oneHour ? "1h" : "5m";
    } else {
      // Auto, as resolvePromptCache decides it
      if (prev) {
        const gap = e.at - prev.e.at;
        if (gap > AUTO_ESCALATE_MIN_GAP_MS && gap <= AUTO_ESCALATE_MAX_GAP_MS) {
          escalated = true;
        }
      }
      counted++;
      if (
        !escalated &&
        isAgentStyleMode(e.mode) &&
        counted >= AUTO_ESCALATE_AT_REQUEST
      ) {
        escalated = true;
      }
      choice = escalated && e.oneHour ? "1h" : "5m";
    }

    const minimum = minCacheableTokens(e.model, e.provider);
    if (choice === "off" || (minimum !== undefined && total < minimum)) {
      usd += (total * p.input) / PER;
      prev = { e, total, ttl: "off" };
      continue;
    }

    // Does the previous entry still exist, and is it a prefix of this prompt?
    let read = 0;
    if (prev && prev.ttl !== "off") {
      const alive = e.at - prev.e.at <= PROMPT_CACHE_TTL_MS[prev.ttl];
      const sameStart =
        !e.pruned && !e.missCauses?.length && prev.e.model === e.model;
      if (alive && sameStart) read = Math.min(prev.total, total);
    }
    const write = total - read;
    usd += (read * p.cacheRead + write * writePrice(p, choice)) / PER;
    prev = { e, total, ttl: choice };
  }
  return usd;
}

export interface ReplayResult {
  /** USD for the input side, by policy. Undefined if a model is unpriced. */
  usd: Partial<Record<ReplayPolicy, number>>;
  /** What the recorded tokens actually cost. */
  actualUsd: number;
  /** Replaying the real choices, to check the replay against `actualUsd`. */
  replayedActualUsd: number;
  /** `replayedActualUsd / actualUsd`; near 1 means the replay can be trusted. */
  fidelity: number;
  requests: number;
  /** The cheapest policy, and how far below the one in use it is. */
  best: ReplayPolicy;
}

/**
 * Cost of the ledger under each policy, with a check that the replay agrees
 * with the recorded tokens. Undefined when there is nothing to replay or a
 * model has no price.
 */
export function replayAll(
  entries: CacheLedgerEntry[],
): ReplayResult | undefined {
  if (entries.length === 0) return undefined;
  const actualUsd = actualInputCost(entries);
  const replayedActualUsd = replayInputCost(entries, "actual");
  if (
    actualUsd === undefined ||
    replayedActualUsd === undefined ||
    actualUsd <= 0
  ) {
    return undefined;
  }
  const usd: ReplayResult["usd"] = {};
  let best: ReplayPolicy = "off";
  for (const policy of REPLAY_POLICIES) {
    const v = replayInputCost(entries, policy);
    if (v === undefined) return undefined;
    usd[policy] = v;
    if (v < (usd[best] ?? Infinity)) best = policy;
  }
  return {
    usd,
    actualUsd,
    replayedActualUsd,
    fidelity: replayedActualUsd / actualUsd,
    requests: entries.length,
    best,
  };
}

export interface CacheSummary {
  requests: number;
  /** Share of all input tokens that were read from the cache, 0 to 1. */
  hitShare: number;
  /** Requests that read little of a cache that should have been warm. */
  misses: number;
  /** The last miss: when it started and the causes the app could name. */
  lastMiss?: { at: number; causes: string[]; tokens: number };
  /**
   * Requests that rebuilt the cache because of something the user or the app
   * did on purpose (a compaction, a model switch), counted apart from misses.
   */
  expectedRebuilds: number;
  /** Input tokens written to the cache, 5-minute and 1-hour. */
  written: { m5: number; h1: number };
}

/** Causes that are the user's own doing; they are not faults in the cache. */
const EXPECTED_CAUSES = [
  /^the model changed/,
  /^the oldest messages were dropped/,
  /^the conversation was shortened/,
];

function isExpected(causes: string[] | undefined): boolean {
  return (
    !!causes?.length &&
    causes.every((c) => EXPECTED_CAUSES.some((r) => r.test(c)))
  );
}

/**
 * Counts for a one-line summary of the session. A request is a miss when the
 * ledger recorded causes for it (the detector only records a request that read
 * little of a cache that should have been warm), unless every cause is one the
 * user or the app chose, which is an expected rebuild.
 * */
export function summarizeLedger(
  entries: CacheLedgerEntry[],
): CacheSummary | undefined {
  const cached = entries.filter((e) => e.cachingOn);
  if (cached.length === 0) return undefined;
  let input = 0;
  let read = 0;
  let misses = 0;
  let expectedRebuilds = 0;
  let lastMiss: CacheSummary["lastMiss"];
  const written = { m5: 0, h1: 0 };
  for (const e of cached) {
    input += entryInputTokens(e);
    read += e.read;
    written.m5 += e.write5m;
    written.h1 += e.write1h;
    if (e.missCauses !== undefined) {
      if (isExpected(e.missCauses)) {
        expectedRebuilds++;
      } else {
        misses++;
        lastMiss = {
          at: e.at,
          causes: e.missCauses,
          tokens: e.write5m + e.write1h,
        };
      }
    }
  }
  return {
    requests: cached.length,
    hitShare: input > 0 ? read / input : 0,
    misses,
    lastMiss,
    expectedRebuilds,
    written,
  };
}

/** "4m 10s", "2 h 5 min": how long ago, for a sentence. */
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function tokensShort(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

/**
 * The one line shown for a session: requests, the share of input read from
 * the cache, and, when there were any, the misses with the last one and the
 * expected rebuilds. Empty when caching was never on, so nothing is shown.
 */
export function formatCacheSummary(
  summary: CacheSummary | undefined,
  now: number,
): string {
  if (!summary) return "";
  const parts = [
    `${summary.requests} request${summary.requests === 1 ? "" : "s"}`,
    `${Math.round(summary.hitShare * 100)}% of input from cache`,
  ];
  if (summary.misses > 0 && summary.lastMiss) {
    const cause = summary.lastMiss.causes.length
      ? `, ${summary.lastMiss.causes.join("; ")}`
      : "";
    parts.push(
      `${summary.misses} miss${summary.misses === 1 ? "" : "es"} (last ${ago(now - summary.lastMiss.at)} ago, ${tokensShort(summary.lastMiss.tokens)} tokens rewritten${cause})`,
    );
  }
  if (summary.expectedRebuilds > 0) {
    parts.push(
      `${summary.expectedRebuilds} expected rebuild${summary.expectedRebuilds === 1 ? "" : "s"}`,
    );
  }
  return parts.join(" \u00b7 ");
}
