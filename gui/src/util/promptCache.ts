import type { ModelDescription } from "core";
import {
  anthropicStyleSupportsOneHourCache,
  bedrockSupportsOneHourCache,
} from "core/llm/llms/bedrockHelpers";
import { normalizeClaudeModelId } from "core/llm/utils/calculateRequestCost";
import { minCacheableTokens } from "core/llm/utils/cacheMinimums";
import { formatClockTime } from "./promptCacheCountdown";
import type { CacheLedgerEntry } from "./cacheLedger";
import type { RequestFailure } from "./requestFailures";

/** What the toolbar menu can set. `undefined` means "follow config.yaml". */
export type PromptCacheSetting = "auto" | "5m" | "1h" | "off";

export type PromptCacheTtl = "5m" | "1h";

/** What the cached prefix was built from. A change to any part rebuilds it. */
export interface PromptCacheKey {
  model: string;
  /** Checksum of the tool names sent, so a change to the tool list is visible. */
  tools: string;
  /** Checksum of the system message. */
  system: string;
  /**
   * A checksum per message after the system message, in order. A conversation
   * only grows, so the previous request's list should be the start of this
   * one's; an earlier entry that differs means a message was edited or removed.
   * Absent on keys made before this field existed, which are not compared.
   */
  messages?: string[];
}

/** A request that should have read the cache and mostly did not. */
export interface PromptCacheMiss {
  readTokens: number;
  expectedTokens: number;
  /** What changed since the last request, in words; empty when unknown. */
  causes: string[];
}

/** Per-session facts the Auto lifetime learns from. Not persisted. */
export interface PromptCacheSessionState {
  /** When the last request in this session started (ms since epoch). */
  lastRequestAt?: number;
  /**
   * How fast a local server last read the uncached part of a prompt, in
   * tokens per second, as it reported it. For estimates of a re-read.
   */
  promptTokensPerSecond?: number;
  /**
   * Auto has moved this conversation to the 1-hour lifetime: it saw a gap that
   * a 1-hour entry would have covered, or the conversation reached
   * `AUTO_ESCALATE_AT_REQUEST` requests in an agent-style mode.
   */
  escalated: boolean;
  /** Why `escalated` was set, for the tooltip. */
  escalatedBy?: "gap" | "requests";
  /**
   * Requests this conversation has sent with caching on, one per model call
   * (a tool loop counts each call). Starts at 0 in every new conversation and
   * is saved with the session, so a resumed one keeps counting.
   */
  requests?: number;
  /** Lifetime the last request wrote its cache entry with. */
  lastTtl?: PromptCacheTtl;
  /**
   * Input tokens of the last completed request as the API counted them
   * (including cache reads and writes). Used to estimate what throwing the
   * cache away would cost.
   */
  lastInputTokens?: number;
  /** Model, mode and tools of the last request. */
  lastKey?: PromptCacheKey;
  /** Requests this session that missed a cache that should have been warm. */
  misses?: number;
  lastMiss?: PromptCacheMiss;
  /** `misses` when the user dismissed the miss notice. */
  missesAcknowledged?: number;
  /** `lastRequestAt` the user dismissed the cold-cache notice for. */
  dismissedColdFor?: number;
  /** The user dismissed the "caching is off" suggestion for this session. */
  dismissedCachingOff?: boolean;
  /**
   * One entry per request this conversation, newest last. In memory only: it is
   * not saved with the session and starts empty in every new conversation.
   */
  ledger?: CacheLedgerEntry[];
  /**
   * Requests that failed (throttled, overloaded, other), newest last. In
   * memory only, like the ledger, and kept apart from it because they carry
   * no token counts.
   */
  failures?: RequestFailure[];
}

export const INITIAL_PROMPT_CACHE_STATE: PromptCacheSessionState = {
  escalated: false,
};

/**
 * A gap between requests longer than this means a 5-minute entry had expired.
 * Lifetimes count from the start of the request that wrote or read the entry.
 */
export const AUTO_ESCALATE_MIN_GAP_MS = 5 * 60 * 1000;
/**
 * Gaps near an hour say little about whether the next one will be, and a
 * 1-hour entry would not have survived them with response time included. A
 * guess; see plans/prompt-caching.md section 6.3.
 */
export const AUTO_ESCALATE_MAX_GAP_MS = 55 * 60 * 1000;
/**
 * Auto moves to the 1-hour lifetime at this request of a conversation, in
 * agent-style modes. A week of real agent traffic (replayed in
 * plans/cache-adaptive-lifetime.md) saves 2.9% to 4.4% for any threshold from
 * 3 to 15, so 5 is a point on a plateau and not a tuned value.
 */
export const AUTO_ESCALATE_AT_REQUEST = 5;

/**
 * Modes that send tools, where each request is a model call in a loop and not
 * a human turn. Chat keeps the gap rule only: no data says what five human
 * turns predict.
 */
export function isAgentStyleMode(mode: string | undefined): boolean {
  return mode === "agent" || mode === "plan" || mode === "background";
}

const TTL_MS: Record<PromptCacheTtl, number> = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};
export const PROMPT_CACHE_TTL_MS = TTL_MS;

/**
 * Whether the toolbar control does anything for this model: the providers whose
 * request builders read `promptCaching` and `promptCacheTtl` per request.
 */
export function modelSupportsPromptCacheControl(
  model: ModelDescription | null | undefined,
): boolean {
  if (!model) return false;
  const provider = model.provider?.toLowerCase();
  return (
    (provider === "anthropic" ||
      provider === "bedrock" ||
      provider === "openrouter" ||
      provider === "vertexai") &&
    normalizeClaudeModelId(model.model) !== undefined
  );
}

/** Providers that talk to a model server the user runs, by default locally. */
const LOCAL_SERVER_PROVIDERS = new Set([
  "openai",
  "llama.cpp",
  "llamafile",
  "lmstudio",
  "vllm",
  "ollama",
  "lemonade",
]);
/** Of those, the ones whose default address is this machine. */
const LOCAL_BY_DEFAULT = new Set([
  "llama.cpp",
  "llamafile",
  "lmstudio",
  "ollama",
  "lemonade",
]);

function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "host.docker.internal" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Whether the model runs on a server the user hosts (Strata, llama.cpp,
 * vLLM, LM Studio, Ollama on this machine or the local network). Such a
 * server keeps the start of the last prompt (llama.cpp's slot cache,
 * Strata's conversation cache) with no request field to control it: there is
 * nothing to pay, but a prompt it must read again can take minutes.
 */
export function modelUsesLocalPrefixCache(
  model: ModelDescription | null | undefined,
): boolean {
  if (!model || modelSupportsPromptCacheControl(model)) return false;
  const provider = model.provider?.toLowerCase() ?? "";
  if (!LOCAL_SERVER_PROVIDERS.has(provider)) return false;
  if (!model.apiBase) return LOCAL_BY_DEFAULT.has(provider);
  try {
    return isLocalHostname(new URL(model.apiBase).hostname);
  } catch {
    return false;
  }
}

/**
 * How long after its last request a local server's cache is taken to still
 * hold the conversation. Local servers keep it until another conversation
 * or an unload pushes it out, which the client cannot see, so this is a
 * guess on the safe side for a warning.
 */
export const LOCAL_CACHE_WARM_MS = 15 * 60 * 1000;

/**
 * Whether a 1-hour lifetime would actually be sent for this model. Anthropic
 * accepts it on every model that supports caching; on Bedrock and OpenRouter
 * only the models in the allowlist get it, and others silently get 5 minutes.
 */
export function modelSupportsOneHourCache(model: ModelDescription): boolean {
  if (!modelSupportsPromptCacheControl(model)) return false;
  switch (model.provider.toLowerCase()) {
    case "anthropic":
      return true;
    case "bedrock":
      // AWS's table, narrower than Anthropic's own.
      return bedrockSupportsOneHourCache(model.model);
    default:
      // Vertex AI and OpenRouter take Anthropic's request shape.
      return anthropicStyleSupportsOneHourCache(model.model);
  }
}

/** Whether config.yaml turns caching on for this model without the toolbar. */
export function configEnablesPromptCaching(model: ModelDescription): boolean {
  const flag = model.completionOptions?.promptCaching;
  if (flag !== undefined) return flag;
  return !!(
    model.cacheBehavior?.cacheConversation ||
    model.cacheBehavior?.cacheSystemMessage
  );
}

/**
 * True when config.yaml says nothing about whether to cache: no
 * `promptCaching`, and neither `cacheConversation` nor `cacheSystemMessage`
 * (an explicit `false` is saying something). Only then may a default apply.
 */
export function configSilentOnCaching(model: ModelDescription): boolean {
  return (
    model.completionOptions?.promptCaching === undefined &&
    model.cacheBehavior?.cacheConversation === undefined &&
    model.cacheBehavior?.cacheSystemMessage === undefined
  );
}

/**
 * The setting every cache calculation should use. It is the toolbar choice
 * when there is one. With none, config.yaml decides if it says anything; when
 * it says nothing, Agent, Plan and Background sessions on a Claude model that
 * takes cache control run Auto (or the fixed lifetime `cacheBehavior.ttl`
 * names), and Chat keeps caching off.
 *
 * Why only those modes: a week of real agent traffic (plans/cache-real-world-data.md)
 * read 12 to 28 times per token written, which saved 85% of input cost, and
 * Auto came within 0.7 points of the best lifetime for each conversation. In
 * Chat a request is a human turn; the data does not cover it, and a
 * conversation of one call pays the 25% write premium for nothing.
 *
 * To opt out: `promptCaching: false` in config, or Off in the toolbar.
 */
export function effectiveCacheSetting(
  model: ModelDescription | null | undefined,
  setting: PromptCacheSetting | undefined,
  mode: string | undefined,
): PromptCacheSetting | undefined {
  if (setting !== undefined || !model) return setting;
  if (!modelSupportsPromptCacheControl(model)) return setting;
  // Vertex AI and OpenRouter honour the setting, but the traffic this default
  // rests on was Anthropic's API and Bedrock; nothing measured covers them.
  const provider = model.provider?.toLowerCase();
  if (provider !== "anthropic" && provider !== "bedrock") return setting;
  if (!configSilentOnCaching(model) || !isAgentStyleMode(mode)) return setting;
  return configTtlPolicy(model) ?? "auto";
}

/** True when the effective setting comes from this default and not from a choice. */
export function cachingIsDefaulted(
  model: ModelDescription | null | undefined,
  setting: PromptCacheSetting | undefined,
  mode: string | undefined,
): boolean {
  return (
    setting === undefined &&
    effectiveCacheSetting(model, setting, mode) !== undefined
  );
}

/**
 * The lifetime policy config.yaml asks for when the toolbar says "Config
 * default": `cacheBehavior.ttl`, with anything unrecognised ignored.
 */
export function configTtlPolicy(
  model: ModelDescription,
): "auto" | PromptCacheTtl | undefined {
  const ttl = model.cacheBehavior?.ttl;
  return ttl === "auto" || ttl === "5m" || ttl === "1h" ? ttl : undefined;
}

export interface PromptCacheResolution {
  /** Fields to merge into the request's completion options. */
  options: { promptCaching?: boolean; promptCacheTtl?: PromptCacheTtl };
  nextState: PromptCacheSessionState;
}

/**
 * Turn the toolbar setting and what this session has done so far into the
 * options for the next request, and the session state after sending it.
 */
export function resolvePromptCache(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  state: PromptCacheSessionState,
  now: number,
  mode?: string,
): PromptCacheResolution {
  if (!modelSupportsPromptCacheControl(model)) {
    return { options: {}, nextState: state };
  }

  // With caching off (toolbar) or not enabled in config, there is nothing to
  // learn or track, and nothing about the request changes.
  const cachingOn =
    setting === undefined
      ? configEnablesPromptCaching(model)
      : setting !== "off";
  if (!cachingOn) {
    return {
      options: setting === "off" ? { promptCaching: false } : {},
      nextState: state,
    };
  }

  let escalated = state.escalated;
  let escalatedBy = state.escalatedBy;
  if (state.lastRequestAt !== undefined) {
    const gap = now - state.lastRequestAt;
    if (gap > AUTO_ESCALATE_MIN_GAP_MS && gap <= AUTO_ESCALATE_MAX_GAP_MS) {
      if (!escalated) escalatedBy = "gap";
      escalated = true;
    }
  }

  // One count per model call, including each call after a tool result.
  const requests = (state.requests ?? 0) + 1;
  const followsAuto =
    setting === "auto" ||
    (setting === undefined && configTtlPolicy(model) === "auto");
  if (
    followsAuto &&
    !escalated &&
    isAgentStyleMode(mode) &&
    requests >= AUTO_ESCALATE_AT_REQUEST
  ) {
    escalated = true;
    escalatedBy = "requests";
  }

  let options: PromptCacheResolution["options"];
  let ttl: PromptCacheTtl;
  switch (setting) {
    case "5m":
    case "1h":
      options = { promptCaching: true, promptCacheTtl: setting };
      ttl = setting;
      break;
    case "auto":
      ttl = escalated ? "1h" : "5m";
      options = { promptCaching: true, promptCacheTtl: ttl };
      break;
    default: {
      // Follow config.yaml, which has caching on: send nothing about whether
      // to cache, so the request is what config alone would produce. A fixed
      // `cacheBehavior.ttl` is applied by the provider itself; "auto" needs
      // the session state, so it is sent as a lifetime.
      const configured = configTtlPolicy(model);
      if (configured === "auto") {
        ttl = escalated ? "1h" : "5m";
        options = { promptCacheTtl: ttl };
      } else {
        ttl = configured ?? "5m";
        options = {};
      }
    }
  }

  // The lifetime the provider will really apply: Bedrock quietly falls back to
  // 5 minutes for models that cannot take 1 hour, and warmth must follow that.
  if (ttl === "1h" && !modelSupportsOneHourCache(model)) {
    ttl = "5m";
  }

  return {
    options,
    nextState: {
      ...state,
      lastRequestAt: now,
      escalated,
      ...(escalatedBy && { escalatedBy }),
      requests,
      lastTtl: ttl,
      lastInputTokens: state.lastInputTokens,
    },
  };
}

/**
 * What changing something that invalidates the cache would cost right now, or
 * undefined when nothing is at stake (cache off, cold or no size known yet).
 *
 * Prices are per million input tokens. Re-reading the conversation at the
 * 5-minute write price (1.25x) instead of the read price (0.1x) costs about
 * 1.15x the input price per token, and the 1-hour write is 1.9x.
 */
export interface SwitchCost {
  tokens: number;
  /** Extra dollars for the next request, or undefined if the model is unpriced. */
  extraUsd?: number;
}

export function switchCost(
  status: PromptCacheStatus,
  state: PromptCacheSessionState,
  pricePerMTokInput: number | undefined,
): SwitchCost | undefined {
  if (!status.on || !status.warm || !state.lastInputTokens) return undefined;
  const tokens = state.lastInputTokens;
  const writeMultiplier = status.ttl === "1h" ? 2 : 1.25;
  const extraUsd =
    pricePerMTokInput === undefined
      ? undefined
      : (tokens / 1_000_000) * pricePerMTokInput * (writeMultiplier - 0.1);
  return { tokens, extraUsd };
}

/** "84k tokens (about $0.31)", for the notice. */
export function formatSwitchCost(cost: SwitchCost): string {
  const tokens =
    cost.tokens >= 1000
      ? `${Math.round(cost.tokens / 1000)}k tokens`
      : `${cost.tokens} tokens`;
  if (cost.extraUsd === undefined) return tokens;
  const usd =
    cost.extraUsd < 0.01 ? "under $0.01" : `about $${cost.extraUsd.toFixed(2)}`;
  return `${tokens} (${usd} more)`;
}

export interface PromptCacheStatus {
  /** Whether requests will carry cache breakpoints. */
  on: boolean;
  /** "1h" when the next request is expected to use the 1-hour lifetime. */
  ttl: PromptCacheTtl;
  /** Whether the last request's entry should still be alive. */
  warm: boolean;
  /** Milliseconds until that entry expires, when warm. */
  msLeft?: number;
  /** When that entry expires (ms since epoch), when warm. */
  expiresAt?: number;
  /** Lifetime of that entry in ms, when warm. */
  lifetimeMs?: number;
  /**
   * The last request was shorter than the model's cache minimum, so the
   * provider cached nothing (and said nothing). Only set when the minimum is
   * known and the API has reported the size.
   */
  belowMinimum?: { tokens: number; minimum: number };
}

export function promptCacheStatus(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  state: PromptCacheSessionState,
  now: number,
): PromptCacheStatus {
  const on =
    setting === undefined
      ? configEnablesPromptCaching(model)
      : setting !== "off";
  const policy = setting ?? configTtlPolicy(model);
  const ttl: PromptCacheTtl =
    policy === "1h" || (policy === "auto" && state.escalated) ? "1h" : "5m";

  // A prompt under the model's minimum is not cached, so there is no entry to
  // be warm or to expire.
  const minimum = minCacheableTokens(model.model, model.provider);
  const belowMinimum =
    on &&
    minimum !== undefined &&
    state.lastInputTokens !== undefined &&
    state.lastInputTokens < minimum
      ? { tokens: state.lastInputTokens, minimum }
      : undefined;

  let warm = false;
  let msLeft: number | undefined;
  let expiresAt: number | undefined;
  let lifetimeMs: number | undefined;
  if (on && !belowMinimum && state.lastRequestAt !== undefined) {
    lifetimeMs = TTL_MS[state.lastTtl ?? "5m"];
    const end = state.lastRequestAt + lifetimeMs;
    if (end > now) {
      warm = true;
      msLeft = end - now;
      expiresAt = end;
    } else {
      lifetimeMs = undefined;
    }
  }
  return { on, ttl, warm, msLeft, expiresAt, lifetimeMs, belowMinimum };
}

/** One-line summary for the toolbar tooltip. */
export function promptCacheTooltip(
  status: PromptCacheStatus,
  setting: PromptCacheSetting | undefined,
  reason?: "gap" | "requests",
): string {
  if (!status.on) {
    return "Prompt cache: off. Every request re-reads the whole conversation at full price.";
  }
  const life = status.ttl === "1h" ? "1 hour" : "5 minutes";
  const why =
    setting === "auto" && status.ttl === "1h" && reason
      ? reason === "requests"
        ? `, switched after ${AUTO_ESCALATE_AT_REQUEST} requests`
        : ", switched after a pause"
      : "";
  const mode =
    setting === "auto"
      ? `Auto (${life}${why})`
      : setting === undefined
        ? `from config (${life})`
        : life;
  if (status.belowMinimum) {
    const { tokens, minimum } = status.belowMinimum;
    return `Prompt cache: ${mode}. Nothing is cached yet: the last request was about ${tokens.toLocaleString()} tokens and this model caches from ${minimum.toLocaleString()}. It starts once the conversation is longer.`;
  }
  if (status.warm && status.msLeft !== undefined) {
    const at =
      status.expiresAt !== undefined
        ? `at ${formatClockTime(status.expiresAt)} (in about ${formatTimeLeft(status.msLeft)})`
        : `in about ${formatTimeLeft(status.msLeft)}`;
    return `Prompt cache: warm, ${mode}. Expires ${at} unless you send something.`;
  }
  return `Prompt cache: ${mode}. Nothing cached right now; the next request writes it.`;
}

/** "41 min", "58 s", for tooltips. */
export function formatTimeLeft(ms: number): string {
  if (ms >= 60 * 60 * 1000) return "1 h";
  if (ms >= 60 * 1000) return `${Math.round(ms / 60000)} min`;
  return `${Math.max(1, Math.round(ms / 1000))} s`;
}

export const PROMPT_CACHE_SETTING_LABELS: Record<
  PromptCacheSetting | "config",
  { label: string; detail: string }
> = {
  config: {
    label: "Config default",
    detail:
      "Follow config.yaml. If it says nothing: Auto in Agent, Plan and Background, off in Chat",
  },
  auto: {
    label: "Auto",
    detail:
      "5 minutes, then 1 hour after 5 requests in Agent, Plan or Background, or once you pause 5 to 55 minutes",
  },
  "5m": {
    label: "5 minutes",
    detail: "Cheapest writes; expires if you pause longer",
  },
  "1h": {
    label: "1 hour",
    detail: "Writes cost 2x instead of 1.25x; survives long pauses",
  },
  off: { label: "Off", detail: "Send the whole prompt at full price" },
};
