import type { ChatMessage, ModelDescription } from "core";
import {
  findAnthropicPricing,
  type ModelPricing,
} from "core/llm/utils/calculateRequestCost";
import {
  AUTO_ESCALATE_MAX_GAP_MS,
  AUTO_ESCALATE_MIN_GAP_MS,
  LOCAL_CACHE_WARM_MS,
  modelSupportsOneHourCache,
  modelSupportsPromptCacheControl,
  modelUsesLocalPrefixCache,
  promptCacheStatus,
  PROMPT_CACHE_TTL_MS,
  type PromptCacheKey,
  type PromptCacheSessionState,
  type PromptCacheSetting,
  type PromptCacheTtl,
} from "./promptCache";

/**
 * Rules for when the app warns about a cost the user may not expect. Every
 * threshold is here so they can be tuned in one place. The reasoning behind
 * them is in plans/cache-safeguards.md.
 */

/** A notice or confirmation needs at least this much extra cost at stake. */
export const NOTICE_MIN_EXTRA_USD = 0.25;
/** The same bar in tokens, for models with no price in the table. */
export const NOTICE_MIN_TOKENS_UNPRICED = 100_000;
/**
 * The bar for a model on the user's own server: nothing to pay, but a local
 * model can take a minute or more to read this much again.
 */
export const NOTICE_MIN_TOKENS_LOCAL = 30_000;
/** The context meter shows from this size, whatever share of the window it is. */
export const CONTEXT_METER_TOKENS = 200_000;
/** A model with a long-context price tier is flagged this far below its limit. */
export const LONG_CONTEXT_WARN_FRACTION = 0.8;

/** What a request would cost beyond a cache hit for the same prompt. */
export interface CacheLoss {
  tokens: number;
  /** Undefined when the model has no price in the table. */
  extraUsd?: number;
  /** The cache is a local server's: the loss is time, not money. */
  local?: boolean;
}

/** Extra dollars to write `tokens` to the cache instead of reading them. */
export function missExtraUsd(
  pricing: ModelPricing,
  tokens: number,
  ttl: PromptCacheTtl,
): number {
  const write = ttl === "1h" ? pricing.cacheWrite1h : pricing.cacheWrite;
  return (tokens / 1_000_000) * (write - pricing.cacheRead);
}

function lossOf(
  model: ModelDescription,
  tokens: number,
  ttl: PromptCacheTtl,
): CacheLoss {
  const pricing = findAnthropicPricing(model.model, tokens);
  return {
    tokens,
    extraUsd: pricing ? missExtraUsd(pricing, tokens, ttl) : undefined,
  };
}

/** Whether a loss is big enough to interrupt the user about. */
export function isSignificantLoss(loss: CacheLoss | undefined): boolean {
  if (!loss) return false;
  if (loss.local) return loss.tokens >= NOTICE_MIN_TOKENS_LOCAL;
  return loss.extraUsd !== undefined
    ? loss.extraUsd >= NOTICE_MIN_EXTRA_USD
    : loss.tokens >= NOTICE_MIN_TOKENS_UNPRICED;
}

/**
 * What changing something that invalidates the cache (the model, the mode's
 * system prompt and tools) would cost right now. Undefined when nothing is at
 * stake: caching is off, the cache is cold, or the size is not known yet.
 */
export function warmCacheLoss(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  state: PromptCacheSessionState,
  now: number,
  /** The model the prompt would be sent to next, if not `model`. */
  target: ModelDescription = model,
): CacheLoss | undefined {
  if (modelUsesLocalPrefixCache(model)) {
    // No setting and no lifetime: warm while the last request was recent
    if (
      !state.lastInputTokens ||
      state.lastRequestAt === undefined ||
      now - state.lastRequestAt > LOCAL_CACHE_WARM_MS
    ) {
      return undefined;
    }
    return { tokens: state.lastInputTokens, local: true };
  }
  if (!modelSupportsPromptCacheControl(model)) return undefined;
  const status = promptCacheStatus(model, setting, state, now);
  if (!status.on || !status.warm || !state.lastInputTokens) return undefined;
  return lossOf(target, state.lastInputTokens, status.ttl);
}

export interface ColdResume extends CacheLoss {
  /** Time since the last request started. */
  idleMs: number;
}

/** What each message costs with caching off, against with the cache warm. */
export interface CachingOffCost {
  tokens: number;
  /** Per message, when the model is priced. */
  perMessageUsd?: number;
  warmUsd?: number;
}

/**
 * With caching off, every message sends the whole conversation at the full
 * input price. Returns that cost when it is big enough to be worth a
 * suggestion; undefined while caching is on, before a size is known, or for a
 * conversation too small to matter.
 */
export function cachingOffCost(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  state: PromptCacheSessionState,
): CachingOffCost | undefined {
  if (!modelSupportsPromptCacheControl(model)) return undefined;
  // An explicit "Off" in the toolbar is a decision, not an oversight.
  if (setting === "off") return undefined;
  if (promptCacheStatus(model, setting, state, 0).on) return undefined;
  const tokens = state.lastInputTokens;
  if (!tokens) return undefined;
  const pricing = findAnthropicPricing(model.model, tokens);
  if (!pricing) {
    return tokens >= NOTICE_MIN_TOKENS_UNPRICED ? { tokens } : undefined;
  }
  const perMessageUsd = (tokens / 1_000_000) * pricing.input;
  const warmUsd = (tokens / 1_000_000) * pricing.cacheRead;
  // The saving per message, if the cache were warm.
  return perMessageUsd - warmUsd >= NOTICE_MIN_EXTRA_USD
    ? { tokens, perMessageUsd, warmUsd }
    : undefined;
}

/**
 * The cost of sending the next message when the cache has expired: the whole
 * conversation is written again instead of read. Undefined while the cache is
 * warm or off, before any request, or when the amount is below the bar.
 */
export function coldResume(
  model: ModelDescription,
  setting: PromptCacheSetting | undefined,
  state: PromptCacheSessionState,
  now: number,
): ColdResume | undefined {
  if (!modelSupportsPromptCacheControl(model)) return undefined;
  const status = promptCacheStatus(model, setting, state, now);
  if (!status.on || status.warm || status.belowMinimum) return undefined;
  if (state.lastRequestAt === undefined || !state.lastInputTokens) {
    return undefined;
  }
  const idleMs = now - state.lastRequestAt;

  // Auto moves to 1 hour on this very request after a pause 1 hour covers.
  let ttl = status.ttl;
  if (
    setting === "auto" &&
    idleMs > AUTO_ESCALATE_MIN_GAP_MS &&
    idleMs <= AUTO_ESCALATE_MAX_GAP_MS
  ) {
    ttl = "1h";
  }
  if (ttl === "1h" && !modelSupportsOneHourCache(model)) ttl = "5m";

  const loss = lossOf(model, state.lastInputTokens, ttl);
  return isSignificantLoss(loss) ? { ...loss, idleMs } : undefined;
}

/** A short stable hash, enough to tell whether a string changed. */
function hashString(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * A checksum of what a message contributes to the prompt. Usage, metadata and
 * IDs are left out: they are attached to a message after it is sent and are
 * not part of what the model reads, so they must not look like an edit.
 */
export function messageChecksum(message: ChatMessage): string {
  const { usage, metadata, id, ...sent } = message as ChatMessage & {
    usage?: unknown;
    metadata?: unknown;
    id?: unknown;
  };
  void usage;
  void metadata;
  void id;
  return hashString(JSON.stringify(sent));
}

/**
 * What the cached prefix is made of. The API caches tools, then the system
 * prompt, then messages, so a change to the model, the tools or the system
 * prompt rebuilds everything after it.
 */
export function promptCacheKey(
  model: ModelDescription,
  toolNames: string[],
  systemMessage: string | undefined,
  /** The messages after the system message, in the order they are sent. */
  messages?: ChatMessage[],
): PromptCacheKey {
  return {
    model: `${model.provider}/${model.model}`,
    tools: hashString(toolNames.join("\u0000")),
    system: hashString(systemMessage ?? ""),
    ...(messages && { messages: messages.map(messageChecksum) }),
  };
}

/** The cause named when the model differs from the previous request's. */
export const MODEL_CHANGED = "the model changed";

/**
 * The first earlier message that is no longer the same, or undefined. Only the
 * messages the previous request sent are compared: whatever follows them is
 * the new turn.
 */
function firstChangedMessage(
  before: string[],
  after: string[],
): number | undefined {
  for (let i = 0; i < before.length; i++) {
    if (after[i] !== before[i]) return i;
  }
  return undefined;
}

/** The parts of the key that differ, as words for a message. */
export function keyChanges(
  before: PromptCacheKey | undefined,
  after: PromptCacheKey,
): string[] {
  if (!before) return [];
  const changes: string[] = [];
  if (before.model !== after.model) changes.push(MODEL_CHANGED);
  if (before.tools !== after.tools) changes.push("the tools changed");
  if (before.system !== after.system) {
    changes.push("the system prompt changed (a rule or a summary)");
  }
  if (before.messages && after.messages) {
    const i = firstChangedMessage(before.messages, after.messages);
    if (i !== undefined) {
      changes.push(
        `an earlier message was edited or removed (message ${i + 1} of ${after.messages.length})`,
      );
    }
  }
  return changes;
}

export const MISS_MIN_PREFIX_TOKENS = 50_000;
/** The miss notice appears after this many unseen misses in a session. */
export const MISS_NOTICE_AFTER = 3;
/**
 * A draft this big (typed, pasted or as code blocks) gets a notice before it
 * is sent: about 120 KB of text at 4 characters per token. It is sent again
 * with every later message, so a big paste is a cost the user can avoid
 * before it is incurred. The size is a guess; tune it from real use.
 */
export const LARGE_MESSAGE_TOKENS = 30_000;
/** A request that read less than this share of the previous prompt missed. */
export const MISS_READ_SHARE = 0.5;

export interface CacheMissReport {
  /** Cache read and previous prompt size, in tokens. */
  readTokens: number;
  expectedTokens: number;
  /** Empty when nothing the app controls changed: the cause is unknown. */
  causes: string[];
}

/**
 * Whether a request that should have read the previous request's cache mostly
 * did not. "Should have" means: caching on, the previous request was inside
 * its lifetime, the prompt only grew, and it was big enough to matter.
 */
export function detectCacheMiss(args: {
  before: PromptCacheSessionState;
  key: PromptCacheKey;
  requestAt: number;
  readTokens: number;
  totalInputTokens: number;
  /** The oldest messages were dropped to fit the window, which moves the start. */
  pruned?: boolean;
}): CacheMissReport | undefined {
  const { before, key, requestAt, readTokens, totalInputTokens } = args;
  const expected = before.lastInputTokens;
  if (!expected || expected < MISS_MIN_PREFIX_TOKENS) return undefined;
  if (before.lastRequestAt === undefined) return undefined;
  const lifetime = PROMPT_CACHE_TTL_MS[before.lastTtl ?? "5m"];
  if (requestAt - before.lastRequestAt > lifetime) return undefined;
  // A shorter prompt means history was cut or compacted: a new prefix by design.
  if (totalInputTokens < expected - 1000) return undefined;
  if (readTokens >= expected * MISS_READ_SHARE) return undefined;
  const causes = keyChanges(before.lastKey, key);
  // A model switch is the user's own doing and is warned about when they make
  // it, so on its own it does not count as a fault worth reporting.
  if (causes.length === 1 && causes[0] === MODEL_CHANGED && !args.pruned) {
    return undefined;
  }
  // Once the window is full, every request drops the oldest messages, so the
  // start of the prompt moves and nothing can be read. That is not a fault in
  // the cache; it is the conversation not fitting.
  if (args.pruned) causes.push("the oldest messages were dropped to fit");
  return { readTokens, expectedTokens: expected, causes };
}

/** Why an expected rebuild happened, for the session summary. */
export const MODEL_SWITCH_CAUSE = MODEL_CHANGED;
export const SHORTER_PROMPT_CAUSE =
  "the conversation was shortened (compaction or truncation)";

/**
 * A request whose cache could not be read because of something the user or the
 * app did on purpose. `detectCacheMiss` stays quiet about these (it only
 * reports faults), so the ledger would not know. Returns the causes, or
 * undefined when the request was an ordinary one.
 *
 * It looks at the same facts as `detectCacheMiss`: caching on, the previous
 * request inside its lifetime and big enough to matter, and little read. Then:
 * a different model is a switch; a prompt shorter than the last one is a
 * compaction or a cut. Anything else is left to `detectCacheMiss`.
 */
export function expectedRebuildCauses(args: {
  before: PromptCacheSessionState;
  key: PromptCacheKey;
  requestAt: number;
  readTokens: number;
  totalInputTokens: number;
}): string[] | undefined {
  const { before, key, requestAt, readTokens, totalInputTokens } = args;
  const expected = before.lastInputTokens;
  if (!expected || expected < MISS_MIN_PREFIX_TOKENS) return undefined;
  if (before.lastRequestAt === undefined) return undefined;
  const lifetime = PROMPT_CACHE_TTL_MS[before.lastTtl ?? "5m"];
  if (requestAt - before.lastRequestAt > lifetime) return undefined;
  if (readTokens >= expected * MISS_READ_SHARE) return undefined;

  const causes: string[] = [];
  if (before.lastKey && before.lastKey.model !== key.model) {
    causes.push(MODEL_SWITCH_CAUSE);
  }
  if (totalInputTokens < expected - 1000) causes.push(SHORTER_PROMPT_CAUSE);
  return causes.length > 0 ? causes : undefined;
}
