import type { RequestFailure } from "./requestFailures";
import { countFailures } from "./requestFailures";
import { type CacheLedgerEntry, summarizeLedger } from "./cacheLedger";
import { AUTO_ESCALATE_AT_REQUEST } from "./promptCache";

/**
 * How many model calls each human prompt took, read from the ledger's stop
 * reasons. A request that stops with `tool_use` is followed by another call in
 * the same prompt (the agent loop), so the next request is a new prompt only
 * when the previous one stopped for any other reason.
 *
 * This is how Auto's request-5 rule (`AUTO_ESCALATE_AT_REQUEST`) can be checked
 * against real use: the rule counts calls, and an agent session reaches 5
 * either inside one long prompt or across several short ones.
 *
 * What it cannot see: a request the provider reported no stop reason for is
 * treated as the end of a prompt (so such requests make prompts look shorter
 * than they were, and `unknownStops` says how many there were), and requests
 * that failed are not in the ledger.
 */
export interface PromptShape {
  prompts: number;
  /** Model calls in each prompt, oldest first. */
  callsPerPrompt: number[];
  median: number;
  max: number;
  /** Prompts that alone took at least `AUTO_ESCALATE_AT_REQUEST` calls. */
  promptsReachingThreshold: number;
  /** Requests with no stop reason, each counted as ending its prompt. */
  unknownStops: number;
}

export function promptShape(
  entries: CacheLedgerEntry[],
): PromptShape | undefined {
  if (entries.length === 0) return undefined;
  const calls: number[] = [];
  let unknownStops = 0;
  entries.forEach((e, i) => {
    if (e.stopReason === undefined) unknownStops++;
    const startsPrompt = i === 0 || entries[i - 1].stopReason !== "tool_use";
    if (startsPrompt) calls.push(1);
    else calls[calls.length - 1]++;
  });
  const sorted = [...calls].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    prompts: calls.length,
    callsPerPrompt: calls,
    median,
    max: sorted[sorted.length - 1],
    promptsReachingThreshold: calls.filter((c) => c >= AUTO_ESCALATE_AT_REQUEST)
      .length,
    unknownStops,
  };
}

/** Bump when the shape of the export changes. */
export const CACHE_EXPORT_VERSION = 1;

export interface CacheExport {
  version: number;
  /** ms since epoch when the export was made. */
  exportedAt: number;
  /** What the export holds and leaves out, for whoever reads it. */
  note: string;
  autoEscalateAtRequest: number;
  summary?: ReturnType<typeof summarizeLedger>;
  promptShape?: PromptShape;
  failureCounts: ReturnType<typeof countFailures>;
  /** One record per request, oldest first. */
  requests: CacheLedgerEntry[];
  failures: RequestFailure[];
}

/**
 * A session's cache record for a bug report or for checking against a bill.
 * Counts, timings, model and provider names and the provider's request IDs; no
 * message text, tool names, file paths or account identifiers. The request IDs
 * are what ties a record to the provider's own logs, so they are kept: remove
 * them before sharing if that matters. A plain copy of what the ledger holds.
 */
export function buildCacheExport(
  ledger: CacheLedgerEntry[] | undefined,
  failures: RequestFailure[] | undefined,
  now: number,
): CacheExport {
  const requests = ledger ?? [];
  return {
    version: CACHE_EXPORT_VERSION,
    exportedAt: now,
    note:
      "Token counts, timings, model and provider names and request IDs for this " +
      "conversation's last requests. No message text, tool names or file paths.",
    autoEscalateAtRequest: AUTO_ESCALATE_AT_REQUEST,
    summary: summarizeLedger(requests),
    promptShape: promptShape(requests),
    failureCounts: countFailures(failures),
    requests,
    failures: failures ?? [],
  };
}

export function cacheExportText(
  ledger: CacheLedgerEntry[] | undefined,
  failures: RequestFailure[] | undefined,
  now: number,
): string {
  return JSON.stringify(buildCacheExport(ledger, failures, now), null, 2);
}
