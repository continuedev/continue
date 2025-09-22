import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";

import { streamChatResponse } from "./stream/streamChatResponse.js";
import { StreamCallbacks } from "./stream/streamChatResponse.types.js";
import { logger } from "./util/logger.js";
import {
  countChatHistoryTokens,
  getModelContextLimit,
} from "./util/tokenizer.js";

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

/**
 * Compacts a chat history into a summarized form
 * @param chatHistory The current chat history to compact
 * @param model The model configuration
 * @param llmApi The LLM API instance
 * @param callbacks Optional callbacks for streaming updates
 * @param abortController Optional abort controller for cancellation
 * @returns The compacted history with compaction index
 */
export async function compactChatHistory(
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  callbacks?: CompactionCallbacks,
  abortController?: AbortController,
): Promise<CompactionResult> {
  // Create a prompt to summarize the conversation
  const compactionPrompt: ChatHistoryItem = {
    message: {
      role: "user" as const,
      content:
        "Please provide a concise summary of our conversation so far, capturing the key context, decisions made, and current state. Format this as a single comprehensive message that preserves all important information needed to continue our work. You do not need to recap the system message, as this will remain. Make sure it is clear what the current stream of work was at the very end prior to compaction so that you can continue exactly where you left off without missing any information.",
    },
    contextItems: [],
  };

  // Check if the history with compaction prompt is too long, prune if necessary
  let historyToUse = chatHistory;
  let historyForCompaction = [...historyToUse, compactionPrompt];

  const contextLimit = getModelContextLimit(model);
  const maxTokens = model.defaultCompletionOptions?.maxTokens;
  const reservedForOutput =
    maxTokens === undefined ? Math.ceil(contextLimit * 0.35) : maxTokens;
  const availableForInput = contextLimit - reservedForOutput;

  // Check if we need to prune to fit within context
  while (
    countChatHistoryTokens(historyForCompaction) > availableForInput &&
    historyToUse.length > 0
  ) {
    logger.debug("Compaction history too long, pruning last message", {
      tokenCount: countChatHistoryTokens(historyForCompaction),
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
    );

    // Create the compacted history with a special marker
    const systemMessage = chatHistory.find(
      (item) => item.message.role === "system",
    );
    const compactionMessage: ChatHistoryItem = {
      message: {
        role: "assistant",
        content: compactionContent,
      },
      contextItems: [],
      conversationSummary: compactionContent,
    };

    const compactedHistory: ChatHistoryItem[] = systemMessage
      ? [systemMessage, compactionMessage]
      : [compactionMessage];

    return {
      compactedHistory,
      compactionContent,
      compactionIndex: systemMessage ? 1 : 0,
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
 * Gets the history to send to the LLM, taking compaction into account
 * @param fullHistory The complete chat history
 * @param compactionIndex The index of the compaction message, if any
 * @returns The history to send to the LLM
 */
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

export function getHistoryForLLM(
  fullHistory: ChatHistoryItem[],
  compactionIndex: number | null,
): ChatHistoryItem[] {
  if (compactionIndex === null || compactionIndex >= fullHistory.length) {
    return fullHistory;
  }

  // Include system message (if at index 0) and everything from compaction index forward
  const systemMessage =
    fullHistory[0]?.message?.role === "system" ? fullHistory[0] : null;
  const messagesFromCompaction = fullHistory.slice(compactionIndex);

  return systemMessage && compactionIndex > 0
    ? [systemMessage, ...messagesFromCompaction]
    : messagesFromCompaction;
}
