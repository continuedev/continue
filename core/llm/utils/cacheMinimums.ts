import { normalizeClaudeModelId } from "./calculateRequestCost";

/**
 * Minimum prompt length, in tokens, for a cache checkpoint to take effect.
 * Below it the request succeeds, the prefix is not cached, and no error is
 * returned: "If you add a cache checkpoint before the total prompt prefix meets
 * the minimum number of tokens, your inference still succeeds, but your prefix
 * isn't cached" (AWS Bedrock prompt caching, checked 2026-11-04). The minimum
 * counts the whole prefix before the checkpoint, across tools, system and
 * messages.
 *
 * Sources: docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html
 * (Bedrock) and platform.claude.com/docs/en/build-with-claude/prompt-caching
 * (Anthropic). They agree except for Claude Opus 4.7: Anthropic lists 2,048 and
 * AWS lists 4,096, so each provider gets its own vendor's number.
 */
interface MinimumRule {
  /** Matches the normalized model ID (see `normalizeClaudeModelId`). */
  match: RegExp;
  anthropic: number;
  bedrock: number;
}

/** A later minor version (`-6` in `claude-sonnet-5-6`) is not this model. */
const NOT_NEXT_MINOR = "(?!-\\d{1,2}(?:-|$))";

const RULES: MinimumRule[] = [
  {
    match: /^claude-(?:opus-5|sonnet-5-5|haiku-5|fable|mythos)/,
    anthropic: 512,
    bedrock: 512,
  },
  { match: /^claude-opus-4-7/, anthropic: 2048, bedrock: 4096 },
  { match: /^claude-opus-4-[56]/, anthropic: 4096, bedrock: 4096 },
  { match: /^claude-haiku-4-5/, anthropic: 4096, bedrock: 4096 },
  {
    match: new RegExp(
      `^claude-(?:opus-4-8|opus-4-1|sonnet-4-[56]|sonnet-5${NOT_NEXT_MINOR}|opus-4${NOT_NEXT_MINOR}|sonnet-4${NOT_NEXT_MINOR})`,
    ),
    anthropic: 1024,
    bedrock: 1024,
  },
];

/**
 * The smallest prompt a cache checkpoint can take effect on for this model, or
 * undefined when the model is not in the vendors' tables (so nothing is claimed).
 */
export function minCacheableTokens(
  model: string,
  provider: string,
): number | undefined {
  const id = normalizeClaudeModelId(model);
  if (!id) return undefined;
  const rule = RULES.find((r) => r.match.test(id));
  if (!rule) return undefined;
  return provider.toLowerCase() === "bedrock" ? rule.bedrock : rule.anthropic;
}
