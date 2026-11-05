/**
 * A per-request opt-out from prompt caching, for side requests that share
 * nothing with the conversation (a session title, for example): they would
 * write a cache entry nobody reads and, with `ttl: auto`, move the
 * conversation's request count along. Only the Anthropic and Bedrock adapters
 * read it, and neither forwards it: both build their own request body. Set it
 * only for those two, because other adapters pass unknown fields on to the
 * provider.
 */
export const NO_PROMPT_CACHE_FIELD = "x_continue_no_prompt_cache";

export function optsOutOfPromptCache(body: unknown): boolean {
  return (
    (body as Record<string, unknown> | undefined)?.[NO_PROMPT_CACHE_FIELD] ===
    true
  );
}

/**
 * Prompt cache lifetimes for the adapters that send them (Anthropic, Bedrock).
 * Anthropic and Bedrock accept `5m` (the default) and `1h`.
 */
export type CacheTtl = "5m" | "1h";

/**
 * The lifetime a request asks for: the per-request value if it is one, else the
 * configured one. "auto" is a policy, not a lifetime, so here it (and anything
 * else) means the provider's default; `AutoCacheTtl` below turns it into "5m"
 * or "1h" for each request. Keep in sync with `resolvePromptCacheTtl` in
 * core/llm/llms/anthropicCache.ts.
 */
export function resolveCacheTtl(
  requested: unknown,
  configured: unknown,
): CacheTtl | undefined {
  for (const value of [requested, configured]) {
    if (value === "5m" || value === "1h") return value;
  }
  return undefined;
}

/**
 * Auto, for a client with no toolbar (the CLI): the adapter instance lives as
 * long as the session, so it counts the session's requests itself. It starts
 * on 5 minutes and moves to 1 hour for the rest of the session in either of
 * two cases, the same two the chat window uses:
 *
 *  - the gap between two requests was more than 5 and at most 55 minutes (a
 *    pause a 1-hour entry would have covered), or
 *  - the session reached its fifth request. The chat window applies this only
 *    in Agent, Plan and Background modes; the CLI has no chat mode, so every
 *    session is treated as agent-style.
 *
 * Keep the numbers in sync with AUTO_ESCALATE_* in gui/src/util/promptCache.ts.
 * The 55 minutes is a guess and 5 requests is a point on a plateau; see
 * plans/cache-adaptive-lifetime.md.
 */
export const AUTO_MIN_GAP_MS = 5 * 60 * 1000;
export const AUTO_MAX_GAP_MS = 55 * 60 * 1000;
export const AUTO_ESCALATE_AT_REQUEST = 5;

export class AutoCacheTtl {
  private requests = 0;
  private lastRequestAt: number | undefined;
  private escalated = false;

  /** The lifetime for the request being sent now; call once per request. */
  next(now: number = Date.now()): CacheTtl {
    if (this.lastRequestAt !== undefined) {
      const gap = now - this.lastRequestAt;
      if (gap > AUTO_MIN_GAP_MS && gap <= AUTO_MAX_GAP_MS) {
        this.escalated = true;
      }
    }
    this.requests += 1;
    if (this.requests >= AUTO_ESCALATE_AT_REQUEST) this.escalated = true;
    this.lastRequestAt = now;
    return this.escalated ? "1h" : "5m";
  }
}

/**
 * The lifetime to put on this request's cache points.
 *
 * - `configured` is `cacheBehavior.ttl`: "5m" and "1h" are used as they are,
 *   "auto" asks `auto` for this request's lifetime, anything else means the
 *   provider's default.
 * - `cachingOn` says whether the request carries any cache point. Auto counts
 *   only those requests, as the chat window does, so a request without cache
 *   points does not advance it.
 */
export function requestedCacheTtl(
  configured: unknown,
  auto: AutoCacheTtl,
  cachingOn: boolean,
  now: number = Date.now(),
): CacheTtl | undefined {
  if (!cachingOn) return undefined;
  if (configured === "auto") return auto.next(now);
  return resolveCacheTtl(undefined, configured);
}

/**
 * The lifetime an OpenAI-format chat body already asks for: "1h" when any
 * `cache_control` in it says so (on a content part, on a tool message, or on a
 * tool definition), else undefined. Core marks the body for OpenRouter before
 * it reaches the adapter, and has already decided whether the model accepts a
 * 1-hour lifetime, so the adapter keeps that decision and has no model list of
 * its own for this.
 */
export function cacheTtlInOpenAIBody(body: {
  messages?: unknown[];
  tools?: unknown[];
}): CacheTtl | undefined {
  const asks = (control: unknown) =>
    (control as { ttl?: unknown } | undefined)?.ttl === "1h";
  for (const message of (body.messages ?? []) as {
    cache_control?: unknown;
    content?: unknown;
  }[]) {
    if (asks(message?.cache_control)) return "1h";
    if (Array.isArray(message?.content)) {
      for (const part of message.content as { cache_control?: unknown }[]) {
        if (asks(part?.cache_control)) return "1h";
      }
    }
  }
  for (const tool of (body.tools ?? []) as { cache_control?: unknown }[]) {
    if (asks(tool?.cache_control)) return "1h";
  }
  return undefined;
}

/**
 * Put `ttl: "1h"` on every `cache_control` in an OpenAI-format chat body, the
 * same places `cacheTtlInOpenAIBody` looks. Returns the body untouched for any
 * other value. Changes the marks in place.
 */
export function applyOpenAIBodyCacheTtl<
  T extends { messages?: unknown[]; tools?: unknown[] },
>(body: T, ttl: CacheTtl | undefined): T {
  if (ttl !== "1h") return body;
  const mark = (holder: unknown) => {
    const control = (holder as { cache_control?: Record<string, unknown> })
      ?.cache_control;
    if (control) control.ttl = "1h";
  };
  for (const message of (body.messages ?? []) as {
    cache_control?: Record<string, unknown>;
    content?: unknown;
  }[]) {
    mark(message);
    if (Array.isArray(message?.content)) message.content.forEach(mark);
  }
  (body.tools ?? []).forEach(mark);
  return body;
}

/**
 * Put `ttl: "1h"` on every `cache_control` in an Anthropic Messages body.
 * Anthropic's strategies mark the system prompt, the last tool and the last
 * two user messages with `{ type: "ephemeral" }`; the default lifetime is 5
 * minutes, so only "1h" needs saying. Returns the body untouched for any other
 * value. Anthropic accepts a 1-hour lifetime on every model that supports
 * caching, so there is no model list here. Changes the blocks in place, as the
 * strategies already do.
 */
export function applyAnthropicCacheTtl<T extends object>(
  body: T,
  ttl: CacheTtl | undefined,
): T {
  if (ttl !== "1h") return body;
  const mark = (block: unknown) => {
    const control = (block as { cache_control?: Record<string, unknown> })
      ?.cache_control;
    if (control) control.ttl = "1h";
  };
  const b = body as {
    system?: unknown;
    tools?: unknown[];
    messages?: { content?: unknown }[];
  };
  if (Array.isArray(b.system)) b.system.forEach(mark);
  b.tools?.forEach(mark);
  for (const message of b.messages ?? []) {
    if (Array.isArray(message.content)) message.content.forEach(mark);
  }
  return body;
}
