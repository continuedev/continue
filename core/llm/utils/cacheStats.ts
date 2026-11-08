import { Usage } from "../..";
import { normalizeClaudeModelId } from "./calculateRequestCost";

/**
 * Whether `usage.promptTokens` excludes tokens read from or written to the
 * cache. True for Claude models on Anthropic and Vertex (Anthropic's
 * `input_tokens`) and for every model on Bedrock: the Converse API's
 * `inputTokens` leaves out the cache for any model, and total input is
 * `inputTokens + cacheReadInputTokens + cacheWriteInputTokens` (AWS Bedrock
 * prompt caching guide, checked 2026-11-08). OpenAI-style providers include
 * cached tokens in `prompt_tokens`, so adding them again would double count.
 * Providers not listed here are treated the OpenAI way.
 */
export function promptTokensExcludeCache(
  provider: string,
  model: string,
): boolean {
  switch (provider.toLowerCase()) {
    case "bedrock":
      return true;
    case "anthropic":
    case "vertexai":
      return normalizeClaudeModelId(model) !== undefined;
    default:
      return false;
  }
}

/** All input tokens of one request as the API counted them. */
export function totalInputTokens(
  provider: string,
  model: string,
  usage: Usage,
): number {
  if (!promptTokensExcludeCache(provider, model)) {
    return usage.promptTokens;
  }
  const d = usage.promptTokensDetails;
  return (
    usage.promptTokens + (d?.cachedTokens ?? 0) + (d?.cacheWriteTokens ?? 0)
  );
}

/** What a provider said about a response, apart from its token counts. */
export type ResponseInfo = NonNullable<Usage["response"]>;

/**
 * `usage` with the response facts attached, or `usage` untouched when the
 * provider sent none. Empty and non-finite values are dropped, so a field is
 * present only when it carries something.
 */
export function withResponseInfo(
  usage: Usage,
  info: {
    stopReason?: string | null;
    latencyMs?: number | null;
    requestId?: string | null;
  },
): Usage {
  const response: ResponseInfo = {};
  if (info.stopReason) response.stopReason = info.stopReason;
  if (typeof info.latencyMs === "number" && Number.isFinite(info.latencyMs)) {
    response.latencyMs = info.latencyMs;
  }
  if (info.requestId) response.requestId = info.requestId;
  return Object.keys(response).length > 0 ? { ...usage, response } : usage;
}
