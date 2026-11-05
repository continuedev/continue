import type { ChatMessage, LLMFullCompletionOptions } from "core";
import { buildChatRequest } from "../redux/util/buildChatRequest";
import type { RootState } from "../redux/store";
import {
  effectiveCacheSetting,
  INITIAL_PROMPT_CACHE_STATE,
  modelSupportsPromptCacheControl,
  promptCacheStatus,
  resolvePromptCache,
} from "./promptCache";

/** What the summary request sends so that it starts like the conversation. */
export interface CompactionPrefix {
  messages: ChatMessage[];
  options: LLMFullCompletionOptions;
}

/**
 * The conversation's own request, for the compaction to extend, or undefined
 * when sending it would not help. Measured on Bedrock (Haiku 4.5, a ~12k token
 * conversation): with the parent's system prompt, tools and cache point the
 * summary request read the whole prefix from the cache; without them it paid
 * full price for the history. But that only holds while the entry is alive:
 * with it expired, the same request would write the whole prefix to a cache
 * the compaction is about to make useless, which costs more than the plain
 * request. So all of these must hold:
 *
 *  - caching is on for this model and the entry is still warm;
 *  - the whole conversation is being compacted. A shorter prefix does not end
 *    at a cache breakpoint, so it would not hit;
 *  - the target message has no summary of its own (a re-compaction ignores it,
 *    which would make the request differ from the conversation's);
 *  - the last request was not pruned to fit, which changes the messages.
 *
 * The messages are `buildChatRequest`'s, the same function the chat uses, and
 * the options are the ones the last request carried: its cache options with its
 * lifetime, not whatever Auto would pick for a request sent now.
 */
export function compactionPrefix(
  state: RootState,
  index: number,
  now: number,
): CompactionPrefix | undefined {
  const history = state.session.history;
  if (index !== history.length - 1) return undefined;
  if (history[index]?.conversationSummary) return undefined;
  if (state.session.isPruned || state.session.isStreaming) return undefined;

  const request = (() => {
    try {
      return buildChatRequest(state);
    } catch {
      return undefined;
    }
  })();
  if (!request) return undefined;
  const { model } = request;
  if (!modelSupportsPromptCacheControl(model)) return undefined;

  const setting = effectiveCacheSetting(
    model,
    state.ui.promptCacheSettings?.[model.title],
    state.session.mode,
  );
  const cacheState = state.session.promptCache ?? INITIAL_PROMPT_CACHE_STATE;
  const status = promptCacheStatus(model, setting, cacheState, now);
  if (!status.on || !status.warm) return undefined;

  // The options of the last request. `resolvePromptCache` gives the shape; the
  // lifetime is the one that request used, since Auto may have moved on since.
  const cacheOptions = {
    ...resolvePromptCache(model, setting, cacheState, now, state.session.mode)
      .options,
  };
  if (cacheOptions.promptCacheTtl !== undefined && cacheState.lastTtl) {
    cacheOptions.promptCacheTtl = cacheState.lastTtl;
  }

  return {
    messages: request.messages,
    options: { ...request.completionOptions, ...cacheOptions },
  };
}
