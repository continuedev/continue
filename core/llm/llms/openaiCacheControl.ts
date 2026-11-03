import type { ChatCompletionCreateParams } from "openai/resources/index";

import { cacheControlFor, PromptCacheTtl } from "./anthropicCache.js";

export interface OpenAICacheOptions {
  /** Mark the system message. */
  system: boolean;
  /** Mark the last block of the last two messages whose role is in `roles`. */
  conversation: boolean;
  /** Mark the last tool definition. */
  tools?: boolean;
  /**
   * Roles that count as the conversation. OpenRouter has only ever marked
   * "user". Vertex also marks "tool", because in Anthropic's format tool
   * results are user-role messages and in an Agent loop they are most of the
   * conversation.
   */
  roles?: ("user" | "tool")[];
  ttl?: PromptCacheTtl;
}

/** Put cache_control on the last text part of a message's content. */
export function addCacheControlToContent(content: any, ttl?: PromptCacheTtl) {
  const cache_control = cacheControlFor(ttl);
  if (typeof content === "string") {
    return [{ type: "text", text: content, cache_control }];
  }
  if (Array.isArray(content)) {
    return content.map((part, idx) =>
      part.type === "text" && idx === content.length - 1
        ? { ...part, cache_control }
        : part,
    );
  }
  return content;
}

/**
 * Add Anthropic `cache_control` to an OpenAI-format chat body, for providers
 * that forward it to Claude models (OpenRouter) or convert it (Vertex AI, via
 * openai-adapters). Same placement as the Anthropic path: the system prompt,
 * the last tool, and the last block of each of the last two user-role messages,
 * which is at most four breakpoints. A tool message cannot carry a content
 * part with cache_control, so it gets `cache_control` on the message itself,
 * which the adapter moves onto the `tool_result` block.
 */
export function applyCacheControlToOpenAIBody(
  body: ChatCompletionCreateParams,
  options: OpenAICacheOptions,
): ChatCompletionCreateParams {
  const roles = options.roles ?? ["user"];
  const { ttl } = options;

  const candidates = body.messages
    .map((m: any, i) =>
      (roles as string[]).includes(m.role) && !!m.content ? i : -1,
    )
    .filter((i) => i !== -1)
    .slice(-2);

  body.messages = body.messages.map((message: any, idx) => {
    if (message.role === "system" && options.system) {
      return {
        ...message,
        content: addCacheControlToContent(message.content, ttl),
      };
    }
    if (options.conversation && candidates.includes(idx)) {
      if (message.role === "tool") {
        return { ...message, cache_control: cacheControlFor(ttl) };
      }
      return {
        ...message,
        content: addCacheControlToContent(message.content, ttl),
      };
    }
    return message;
  });

  if (options.tools && body.tools && body.tools.length > 0) {
    const last = body.tools.length - 1;
    body.tools = body.tools.map((tool, i) =>
      i === last
        ? ({ ...tool, cache_control: cacheControlFor(ttl) } as any)
        : tool,
    );
  }

  return body;
}
