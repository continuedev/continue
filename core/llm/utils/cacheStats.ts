import { Usage } from "../..";
import { normalizeClaudeModelId } from "./calculateRequestCost";

/**
 * Whether `usage.promptTokens` excludes tokens read from or written to the
 * cache. True for Claude models on Anthropic, Bedrock and Vertex (Anthropic's
 * `input_tokens`, Bedrock's `inputTokens`). OpenAI-style providers include
 * cached tokens in `prompt_tokens`, so adding them again would double count.
 * Providers not listed here are treated the OpenAI way.
 */
export function promptTokensExcludeCache(
  provider: string,
  model: string,
): boolean {
  switch (provider.toLowerCase()) {
    case "anthropic":
    case "bedrock":
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
