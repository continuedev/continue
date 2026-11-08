import { DEFAULT_MAX_TOKENS } from "./constants.js";
import { isLocalApiBase } from "./localServers.js";

/**
 * The most a local model is asked to generate in one reply when nothing
 * configures it. Large enough for the biggest tool calls seen in practice, and
 * still an end to a model that has started repeating itself.
 */
export const LOCAL_MAX_OUTPUT_TOKENS = 131_072;

/**
 * The output limit for a request to a local server, when the model does not
 * set one: whatever room the context has left, up to the ceiling. Cutting a
 * tool call off is expensive (a truncated file edit), and asking for more room
 * costs a local server nothing: pruning reserves a fixed small amount for the
 * reply, so this does not take space from the conversation.
 *
 * Returns undefined when the default should stand: a hosted provider, which
 * can reject a value above its own limit; or a limit the person configured
 * (the 4096 default is treated as not configured).
 */
export function localOutputLimit(input: {
  apiBase?: string;
  maxTokens?: number;
  outputTokensAvailable?: number;
}): number | undefined {
  const { apiBase, maxTokens, outputTokensAvailable } = input;
  if (!apiBase || !isLocalApiBase(apiBase)) return undefined;
  if (maxTokens !== undefined && maxTokens !== DEFAULT_MAX_TOKENS) {
    return undefined;
  }
  if (!outputTokensAvailable) return undefined;
  return Math.max(
    DEFAULT_MAX_TOKENS,
    Math.min(outputTokensAvailable, LOCAL_MAX_OUTPUT_TOKENS),
  );
}
