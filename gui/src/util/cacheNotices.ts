import type { ModelDescription } from "core";
import { findAnthropicPricing } from "core/llm/utils/calculateRequestCost";
import {
  LONG_CONTEXT_WARN_FRACTION,
  CONTEXT_METER_TOKENS,
} from "./cacheSafeguards";
import type { PromptCacheTtl } from "./promptCache";

/** "12 min", "2 h", "3 days", for "expired 12 min ago". */
export function formatIdle(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** "$0.03", "under $0.01". */
export function formatUsd(usd: number): string {
  return usd < 0.01 ? "under $0.01" : `$${usd.toFixed(2)}`;
}

/** "366k". */
export function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`;
}

/** "40 s", "3 min", "1.5 h". */
export function formatReadTime(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  if (seconds < 90 * 60) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/**
 * What re-reading a warm cache costs, ending a sentence that starts with a
 * verb such as "re-reads": "366k tokens at full price (about $1.10 more)",
 * or for a local server "366k tokens from scratch on the model server".
 */
export function formatRereadCost(loss: {
  tokens: number;
  extraUsd?: number;
  local?: boolean;
  seconds?: number;
}): string {
  if (loss.local) {
    const time =
      loss.seconds !== undefined
        ? ` (about ${formatReadTime(loss.seconds)} at its last speed)`
        : "";
    return `${formatTokens(loss.tokens)} tokens from scratch on the model server${time}`;
  }
  const cost =
    loss.extraUsd !== undefined
      ? ` (about ${formatUsd(loss.extraUsd)} more)`
      : "";
  return `${formatTokens(loss.tokens)} tokens at full price${cost}`;
}

/** Context size at which the context meter appears for this model. */
export function contextMeterTokens(
  model: ModelDescription | null | undefined,
): number {
  const tier = model && findAnthropicPricing(model.model)?.longContext;
  return tier
    ? Math.round(tier.aboveTokens * LONG_CONTEXT_WARN_FRACTION)
    : CONTEXT_METER_TOKENS;
}

/** What one more message costs at this size, with the cache warm and expired. */
export function perMessageCost(
  model: ModelDescription,
  tokens: number,
  ttl: PromptCacheTtl = "5m",
): { warmUsd: number; coldUsd: number } | undefined {
  const pricing = findAnthropicPricing(model.model, tokens);
  if (!pricing) return undefined;
  const write = ttl === "1h" ? pricing.cacheWrite1h : pricing.cacheWrite;
  return {
    warmUsd: (tokens / 1_000_000) * pricing.cacheRead,
    coldUsd: (tokens / 1_000_000) * write,
  };
}

/**
 * A line about a model that charges more per token for long prompts, once the
 * prompt is near or past the limit. Undefined for models without such a tier.
 */
export function longContextNote(
  model: ModelDescription,
  tokens: number,
): string | undefined {
  const base = findAnthropicPricing(model.model);
  const tier = base?.longContext;
  if (!base || !tier) return undefined;
  const times = Math.round(tier.pricing.input / base.input);
  const limit = formatTokens(tier.aboveTokens);
  if (tokens > tier.aboveTokens) {
    return `Prompts over ${limit} tokens cost ${times}x per token on this model, and this one is ${formatTokens(tokens)}.`;
  }
  if (tokens >= tier.aboveTokens * LONG_CONTEXT_WARN_FRACTION) {
    return `This model charges ${times}x per token once a prompt passes ${limit} tokens. This one is ${formatTokens(tokens)}.`;
  }
  return undefined;
}

/**
 * Anthropic documents that accuracy and recall fall as the context grows, so
 * a long session costs more and can answer worse.
 */
export const QUALITY_NOTE =
  "Answers can also get less reliable as the context grows. For an unrelated task, a new session is cheaper and usually better.";
