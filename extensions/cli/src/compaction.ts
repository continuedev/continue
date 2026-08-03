import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import { encode } from "gpt-tokenizer";
import { ChatCompletionTool } from "openai/resources.mjs";

import { streamChatResponse } from "./stream/streamChatResponse.js";
import { StreamCallbacks } from "./stream/streamChatResponse.types.js";
import { logger } from "./util/logger.js";
import {
  countChatHistoryItemTokens,
  countChatHistoryTokens,
  countToolDefinitionTokens,
  countTotalInputTokens,
  getModelContextLimit,
  getModelMaxTokens,
} from "./util/tokenizer.js";

// Buffer cap/ratio for auto-compaction threshold calculation
export const AUTO_COMPACT_BUFFER_CAP = 15_000;
export const AUTO_COMPACT_BUFFER_RATIO = 0.8;

export interface CompactionResult {
  compactedHistory: ChatHistoryItem[];
  compactionIndex: number;
  compactionContent: string;
}

export interface CompactionCallbacks {
  onStreamContent?: (content: string) => void;
  onStreamComplete?: () => void;
  onError?: (error: Error) => void;
}

export interface CompactionOptions {
  callbacks?: CompactionCallbacks;
  abortController?: AbortController;
  systemMessageTokens?: number;
}

// A structured briefing prompt (inspired by Reasonix's summarySystemPrompt) so
// the compaction digest is a dependable briefing the model can resume from:
// the section layout mirrors what a coding agent needs mid-task — the goal
// verbatim, concrete file/code state, and an explicit next step.
const COMPACTION_PROMPT = `You are compacting the earlier part of a coding agent's conversation to save context.
The agent keeps your summary alongside the user's own turns (kept verbatim) and the recent tail; your job is to fold the assistant/tool work into a briefing it can resume from.
Write under these exact headings, omitting a heading only if it has no content:

## Standing facts & constraints
Everything the user stated that still governs the work — names, paths, IDs, versions, tokens, preferences, and hard "never do X" rules — in their own words. Be exhaustive; this is the durable contract, so prefer over- to under-including.

## Goal
The user's request and intent.

## Decisions & rationale
Key choices made so far and why — so they are not re-litigated or reversed.

## Files & code
Files read or modified, with the specific facts that matter: signatures, line locations, data shapes, and exact edits applied. Be concrete; this is what lets the agent act without re-reading everything.

## Commands & outcomes
Commands run (builds, tests, git) and their relevant results — what passed, what failed, and the error text that matters.

## Errors & fixes
Problems hit and how they were resolved (or not), so the same dead ends are not repeated.

## Pending & next step
What is still in progress or unstarted, and the single most concrete next action to take.

Rules: be terse — bullet points and fragments, not prose. Preserve identifiers, paths, and numbers exactly. Do NOT invent anything not present in the messages; if something is unknown, leave it out rather than guessing.`;

const COMPACTION_PROMPT_TOKENS = 700; // rough generous token count of ^

// Token budget for the verbatim recent tail kept after a compaction. Bounded so
// a few large tool outputs cannot keep the tail above the auto-compaction
// trigger and re-fire compaction on every turn.
const RECENT_TAIL_TOKEN_BUDGET = 12_000;
// Never keep fewer recent messages than this after a compaction.
const MIN_RECENT_TAIL_MESSAGES = 2;
// Ceiling on pinning the first user turn verbatim; larger first turns (pasted
// content) stay foldable so pinning never starves the context window.
const MAX_PINNED_FIRST_USER_TOKENS = 1_500;

/**
 * Returns the number of leading messages that a compaction must preserve
 * verbatim: the system prompt, the first user turn (its task + stated facts)
 * when it is small enough to be a brief, and any prior compaction digests.
 * This keeps the prompt prefix byte-identical across turns — the invariant
 * that lets providers with automatic prompt caching (DeepSeek, OpenAI) serve
 * cache hits on subsequent requests. It also guarantees a fold never
 * summarizes the user's stated facts away, and a later fold never
 * re-summarizes an earlier digest into nothing.
 */
function getPinnedPrefixLength(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
): number {
  let i = 0;
  if (chatHistory.length > 0 && chatHistory[0].message.role === "system") {
    i++;
  }
  if (
    i < chatHistory.length &&
    chatHistory[i].message.role === "user" &&
    chatHistory[i].conversationSummary === undefined &&
    countChatHistoryItemTokens(chatHistory[i], model) <=
      MAX_PINNED_FIRST_USER_TOKENS
  ) {
    i++;
  }
  while (
    i < chatHistory.length &&
    chatHistory[i].conversationSummary !== undefined
  ) {
    i++;
  }
  return i;
}

/**
 * Walks newest → oldest, growing the verbatim recent tail until the next
 * message would push its token estimate past RECENT_TAIL_TOKEN_BUDGET (but
 * never below MIN_RECENT_TAIL_MESSAGES messages), then aligns the boundary
 * back off any tool result so the tail never begins with an orphan whose
 * assistant tool_calls were folded away.
 */
function getRecentTailStart(
  chatHistory: ChatHistoryItem[],
  pinnedLength: number,
  model: ModelConfig,
): number {
  let start = chatHistory.length;
  let acc = 0;
  // Walk from the newest message down to (and including) the first message
  // after the pinned prefix, so a conversation that entirely fits within
  // pinned prefix + tail budget is recognized as a no-op (`start` reaches
  // `pinnedLength` and the fold region is empty) instead of being folded.
  for (let i = chatHistory.length - 1; i >= pinnedLength; i--) {
    const tokens = countChatHistoryItemTokens(chatHistory[i], model);
    if (
      chatHistory.length - i > MIN_RECENT_TAIL_MESSAGES &&
      acc + tokens > RECENT_TAIL_TOKEN_BUDGET
    ) {
      break;
    }
    acc += tokens;
    start = i;
  }
  while (
    start > pinnedLength &&
    start < chatHistory.length &&
    chatHistory[start].message.role === "tool"
  ) {
    start--;
  }
  return start;
}

/**
 * Compacts a chat history into a summarized form
 * @param chatHistory The current chat history to compact
 * @param model The model configuration
 * @param llmApi The LLM API instance
 * @param options Optional configuration including callbacks, abort controller, and system message tokens
 * @returns The compacted history with compaction index
 */
export async function compactChatHistory(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  options?: CompactionOptions,
): Promise<CompactionResult> {
  const { callbacks, abortController, systemMessageTokens = 0 } = options || {};

  // Prefix-aware layout (Reasonix-style): pin the cache-stable prefix and keep
  // a token-budgeted recent tail, so compaction splices a summary in the middle
  // instead of collapsing the whole history into [system, summary]. Keeping the
  // prompt prefix byte-identical across turns is what lets providers with
  // automatic prompt caching (DeepSeek, OpenAI) serve cache hits on subsequent
  // requests — and it stops a fold from ever summarizing away the user's first
  // turn or an earlier digest.
  const pinnedLength = getPinnedPrefixLength(chatHistory, model);
  const tailStart = getRecentTailStart(chatHistory, pinnedLength, model);

  // Nothing worth folding: the whole conversation already fits in the pinned
  // prefix + recent tail, so leave it untouched. Producing a summary here would
  // only add tokens without reducing what is sent.
  if (tailStart <= pinnedLength) {
    const index = findCompactionIndex(chatHistory);
    return {
      compactedHistory: [...chatHistory],
      compactionContent: "",
      compactionIndex: index ?? pinnedLength,
    };
  }

  // Create a prompt to summarize the conversation
  const compactionPrompt: ChatHistoryItem = {
    message: {
      role: "user" as const,
      content: COMPACTION_PROMPT,
    },
    contextItems: [],
  };

  // Check if the history with compaction prompt is too long, prune if necessary
  let historyToUse = chatHistory;
  let historyForCompaction = [...historyToUse, compactionPrompt];

  const contextLimit = getModelContextLimit(model);
  const maxTokens = getModelMaxTokens(model);

  // Check if system message is already in the history to avoid double-counting
  const hasSystemMessageInHistory = chatHistory.some(
    (item) => item.message.role === "system",
  );

  // Account for system message (if not already in history) AND compaction prompt
  const systemMessageReservation = hasSystemMessageInHistory
    ? 0
    : systemMessageTokens;

  const availableForInput =
    contextLimit -
    maxTokens -
    systemMessageReservation -
    COMPACTION_PROMPT_TOKENS;

  // Check if we need to prune to fit within context
  while (
    countChatHistoryTokens(historyForCompaction, model) > availableForInput &&
    historyToUse.length > 0
  ) {
    logger.debug("Compaction history too long, pruning last message", {
      tokenCount: countChatHistoryTokens(historyForCompaction, model),
      availableForInput,
      historyLength: historyToUse.length,
    });
    const prunedHistory = pruneLastMessage(historyToUse);

    // Break if pruning didn't change the history (prevents infinite loop)
    if (prunedHistory.length === historyToUse.length) {
      logger.warn(
        "Cannot prune history further while maintaining valid conversation structure",
      );
      break;
    }

    historyToUse = prunedHistory;
    historyForCompaction = [...historyToUse, compactionPrompt];
  }

  // Stream the compaction response (service drives updates; this collects content locally)
  const controller = abortController || new AbortController();

  let compactionContent = "";
  const streamCallbacks: StreamCallbacks = {
    onContent: (content: string) => {
      compactionContent += content;
      callbacks?.onStreamContent?.(content);
    },
    onContentComplete: () => {
      callbacks?.onStreamComplete?.();
    },
  };

  try {
    await streamChatResponse(
      historyForCompaction,
      model,
      llmApi,
      controller,
      streamCallbacks,
      true,
    );

    // Create the compacted history with a special marker
    const compactionMessage: ChatHistoryItem = {
      message: {
        role: "assistant",
        content: compactionContent,
      },
      contextItems: [],
      conversationSummary: compactionContent,
    };

    // Splice the new digest between the pinned prefix and the recent tail so
    // the cache-stable prefix (system, first user turn, prior digests) and the
    // verbatim recent tail survive the compaction.
    const compactedHistory: ChatHistoryItem[] = [
      ...chatHistory.slice(0, pinnedLength),
      compactionMessage,
      ...chatHistory.slice(tailStart),
    ];

    return {
      compactedHistory,
      compactionContent,
      compactionIndex: pinnedLength,
    };
  } catch (error) {
    logger.error("Compaction failed", error);
    callbacks?.onError?.(error as Error);
    throw error;
  }
}

/**
 * Finds the compaction index in a chat history
 * @param chatHistory The chat history to search
 * @returns The index of the compaction message, or null if not found
 */
export function findCompactionIndex(
  chatHistory: ChatHistoryItem[],
): number | null {
  const compactedIndex = chatHistory.findIndex(
    (item) => item.conversationSummary !== undefined,
  );
  return compactedIndex === -1 ? null : compactedIndex;
}

/**
 * Prunes chat history by removing messages from the end while ensuring
 * the history ends with either an assistant message or a tool result message
 * @param chatHistory The chat history to prune
 * @returns The pruned chat history ending with assistant or tool message
 */
export function pruneLastMessage(
  chatHistory: ChatHistoryItem[],
): ChatHistoryItem[] {
  if (chatHistory.length === 0) {
    return chatHistory;
  }

  if (chatHistory.length === 1) {
    // Only one message - always return empty array
    return [];
  }

  const secondToLastIndex = chatHistory.length - 2;
  const secondToLastItem = chatHistory[secondToLastIndex];

  if (
    secondToLastItem.message.role === "assistant" &&
    (secondToLastItem.message as any).toolCalls?.length > 0
  ) {
    return chatHistory.slice(0, -2);
  } else if (secondToLastItem.message.role === "user") {
    return chatHistory.slice(0, -2);
  }

  return chatHistory.slice(0, -1);
}

/**
 * Gets the history to send to the LLM, taking compaction into account.
 *
 * After compaction the stored history already IS the compacted history
 * (pinned prefix + summary + recent tail), so it is sent in full: trimming
 * anything before the compaction index would drop the cache-stable pinned
 * prefix (system message, first user turn, prior digests) that subsequent
 * requests depend on for prompt-cache hits.
 * @param fullHistory The complete chat history
 * @param _compactionIndex The index of the compaction message, if any
 * @returns The history to send to the LLM
 */
export function getHistoryForLLM(
  fullHistory: ChatHistoryItem[],
  _compactionIndex: number | null,
): ChatHistoryItem[] {
  return fullHistory;
}

/**
 * Parameters for auto-compaction check
 */
export interface AutoCompactParams {
  chatHistory: ChatHistoryItem[];
  model: ModelConfig;
  systemMessage?: string;
  tools?: ChatCompletionTool[];
}

/**
 * Get a descriptive message for auto-compaction that shows the context limit
 * @param model The model configuration
 * @returns A descriptive message explaining why compaction is needed
 */
export function getAutoCompactMessage(model: ModelConfig): string {
  const limit = getModelContextLimit(model);
  return `Approaching context limit (${(limit / 1000).toFixed(0)}K tokens). Auto-compacting chat history...`;
}

/**
 * Check if the chat history exceeds the auto-compact threshold.
 * Accounts for system message and tool definitions in the calculation.
 * @param params Object containing chatHistory, model, optional systemMessage, and optional tools
 * @returns Whether auto-compacting should be triggered
 */
export function shouldAutoCompact(params: AutoCompactParams): boolean {
  const { chatHistory, model, systemMessage, tools } = params;

  const inputTokens = countTotalInputTokens({
    chatHistory,
    systemMessage,
    tools,
    model,
  });
  const contextLimit = getModelContextLimit(model);
  const maxTokens = getModelMaxTokens(model);

  // Additional buffer matching the auto-compaction threshold formula
  const ratioCompactionBuffer = Math.ceil(
    (1 - AUTO_COMPACT_BUFFER_RATIO) * (contextLimit - maxTokens),
  );
  const safeCompactionBuffer = Math.max(maxTokens, ratioCompactionBuffer);
  const compactionBuffer = Math.min(
    safeCompactionBuffer,
    AUTO_COMPACT_BUFFER_CAP,
  );

  const compactionThreshold = contextLimit - maxTokens - compactionBuffer;

  // Ensure we have positive space available for input
  if (compactionThreshold <= 0) {
    throw new Error(
      `max_tokens is larger than context_length, which should not be possible. Please check your configuration.`,
    );
  }

  const toolTokens = tools ? countToolDefinitionTokens(tools) : 0;
  const systemTokens = systemMessage ? encode(systemMessage).length : 0;
  const shouldCompact = inputTokens >= compactionThreshold;

  logger.debug("Context usage check", {
    inputTokens,
    historyTokens: countChatHistoryTokens(chatHistory, model),
    systemTokens,
    toolTokens,
    contextLimit,
    maxTokens,
    reservedForOutput: maxTokens,
    compactionBuffer,
    compactionThreshold,
    shouldCompact,
  });

  return shouldCompact;
}
