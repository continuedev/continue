import type { ModelDescription } from "core";
import { bedrockSupportsOneHourCache } from "core/llm/llms/bedrockHelpers";
import { normalizeClaudeModelId } from "core/llm/utils/calculateRequestCost";

/** What the toolbar menu can set. `undefined` means "follow config.yaml". */
export type PromptCacheSetting = "auto" | "5m" | "1h" | "off";

export type PromptCacheTtl = "5m" | "1h";

/** Per-session facts the Auto lifetime learns from. Not persisted. */
export interface PromptCacheSessionState {
  /** When the last request in this session started (ms since epoch). */
  lastRequestAt?: number;
  /** Auto has seen a gap that a 1-hour lifetime would have covered. */
  escalated: boolean;
  /** Lifetime the last request wrote its cache entry with. */
  lastTtl?: PromptCacheTtl;
  /**
   * Input tokens of the last completed request as the API counted them
   * (including cache reads and writes). Used to estimate what throwing the
   * cache away would cost.
   */
  lastInputTokens?: number;
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

const TTL_MS: Record<PromptCacheTtl, number> = {
  "5m": 5 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

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
    (provider === "anthropic" || provider === "bedrock") &&
    normalizeClaudeModelId(model.model) !== undefined
  );
}

/**
 * Whether a 1-hour lifetime would actually be sent for this model. Anthropic
 * accepts it on every model that supports caching; on Bedrock only the models
 * in the allowlist do, and others silently get 5 minutes.
 */
export function modelSupportsOneHourCache(model: ModelDescription): boolean {
  if (!modelSupportsPromptCacheControl(model)) return false;
  return model.provider.toLowerCase() === "bedrock"
    ? bedrockSupportsOneHourCache(model.model)
    : true;
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
  if (state.lastRequestAt !== undefined) {
    const gap = now - state.lastRequestAt;
    if (gap > AUTO_ESCALATE_MIN_GAP_MS && gap <= AUTO_ESCALATE_MAX_GAP_MS) {
      escalated = true;
    }
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
      lastRequestAt: now,
      escalated,
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

  let warm = false;
  let msLeft: number | undefined;
  if (on && state.lastRequestAt !== undefined) {
    const expiresAt = state.lastRequestAt + TTL_MS[state.lastTtl ?? "5m"];
    if (expiresAt > now) {
      warm = true;
      msLeft = expiresAt - now;
    }
  }
  return { on, ttl, warm, msLeft };
}

/** One-line summary for the toolbar tooltip. */
export function promptCacheTooltip(
  status: PromptCacheStatus,
  setting: PromptCacheSetting | undefined,
): string {
  if (!status.on) {
    return "Prompt cache: off. Every request re-reads the whole conversation at full price.";
  }
  const life = status.ttl === "1h" ? "1 hour" : "5 minutes";
  const mode =
    setting === "auto"
      ? `Auto (${life})`
      : setting === undefined
        ? `from config (${life})`
        : life;
  if (status.warm && status.msLeft !== undefined) {
    return `Prompt cache: warm, ${mode}. Expires in about ${formatTimeLeft(status.msLeft)} unless you send something.`;
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
    detail: "Follow config.yaml; off unless the model sets promptCaching",
  },
  auto: {
    label: "Auto",
    detail: "5 minutes, then 1 hour once you pause 5 to 55 minutes",
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
