import type {
  CacheControlEphemeral,
  ContentBlockParam,
  MessageParam,
} from "@anthropic-ai/sdk/resources/messages.mjs";

/** Lifetime of a prompt cache entry. Anthropic's default is 5 minutes. */
export type PromptCacheTtl = "5m" | "1h";

/**
 * The lifetime to send: the per-request choice (toolbar) wins over the model's
 * `cacheBehavior.ttl`. "auto" in config is not a lifetime, it is a policy the
 * chat window turns into "5m" or "1h" for each request, so here it (and any
 * unrecognised value) means "send nothing", which is the 5-minute default.
 */
export function resolvePromptCacheTtl(
  requested: unknown,
  configured: unknown,
): PromptCacheTtl | undefined {
  for (const value of [requested, configured]) {
    if (value === "5m" || value === "1h") return value;
  }
  return undefined;
}

/**
 * The `cache_control` value for a lifetime. The default lifetime is left
 * implicit, which keeps requests identical to what was sent before lifetimes
 * were configurable.
 */
export function cacheControlFor(ttl?: PromptCacheTtl): CacheControlEphemeral {
  return ttl === "1h"
    ? { type: "ephemeral", ttl: "1h" }
    : { type: "ephemeral" };
}

type Markable = { cache_control?: CacheControlEphemeral | null };

/** Where to put cache breakpoints on one request. */
export interface CacheParts {
  tools: boolean;
  system: boolean;
  conversation: boolean;
}

/**
 * Decide which parts of a request get breakpoints.
 *
 * `requested` is the per-request `promptCaching` option (already merged with the
 * model's configured default). An explicit `false` turns everything off, even
 * when `cacheBehavior` says otherwise, so the toolbar can switch caching off.
 * `true` caches tools, system prompt and conversation (three of the four
 * breakpoints the API allows, plus one more on the conversation). When it is
 * unset, only the legacy `cacheBehavior` switches apply.
 */
export function resolveCacheParts(
  requested: boolean | undefined,
  behavior:
    { cacheSystemMessage?: boolean; cacheConversation?: boolean } | undefined,
  hasSystem: boolean,
): CacheParts {
  if (requested === false) {
    return { tools: false, system: false, conversation: false };
  }
  if (requested === true) {
    return { tools: true, system: hasSystem, conversation: true };
  }
  return {
    tools: false,
    system: !!(behavior?.cacheSystemMessage && hasSystem),
    conversation: !!behavior?.cacheConversation,
  };
}

/** Mark the last tool definition so the whole tool list is cached. */
export function markLastToolForCache<T extends Markable>(
  tools: T[] | undefined,
  ttl?: PromptCacheTtl,
): void {
  if (tools && tools.length > 0) {
    tools[tools.length - 1].cache_control = cacheControlFor(ttl);
  }
}

/**
 * The last block of a user message that can carry a breakpoint, or undefined.
 * Thinking blocks cannot be cached directly, empty text cannot be cached, and
 * a tool result with no content is skipped to be safe.
 */
function lastCacheableBlock(
  content: ContentBlockParam[],
): Markable | undefined {
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i];
    if (block.type === "text") {
      if (block.text) return block;
    } else if (block.type === "tool_result") {
      if (block.content && block.content.length > 0) return block;
    } else if (
      block.type !== "thinking" &&
      block.type !== "redacted_thinking"
    ) {
      return block as Markable;
    }
  }
  return undefined;
}

/**
 * Put a cache breakpoint on the last block of each of the last two user-role
 * messages: the second to last is where the previous request wrote its entry
 * (so this request can read it), and the last is where this request writes.
 *
 * In an Agent loop the user-role messages after the first are tool results, so
 * the breakpoint cannot be restricted to text blocks. Mutates `messages`.
 */
export function markCacheBreakpoints(
  messages: MessageParam[],
  ttl?: PromptCacheTtl,
): void {
  let marked = 0;
  for (let i = messages.length - 1; i >= 0 && marked < 2; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;

    if (typeof message.content === "string") {
      if (!message.content) continue;
      message.content = [
        {
          type: "text",
          text: message.content,
          cache_control: cacheControlFor(ttl),
        },
      ];
      marked++;
      continue;
    }

    const block = lastCacheableBlock(message.content);
    if (block) {
      block.cache_control = cacheControlFor(ttl);
      marked++;
    }
  }
}
