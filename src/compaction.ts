import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { streamChatResponse } from "./streamChatResponse.js";
import { StreamCallbacks } from "./streamChatResponse.types.js";
import { logger } from "./util/logger.js";

export const COMPACTION_MARKER = "[COMPACTED HISTORY]";

export interface CompactionResult {
  compactedHistory: ChatCompletionMessageParam[];
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
 * @returns The compacted history with compaction index
 */
export async function compactChatHistory(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  callbacks?: CompactionCallbacks,
): Promise<CompactionResult> {
  // Create a prompt to summarize the conversation
  const compactionPrompt: ChatCompletionMessageParam = {
    role: "user",
    content:
      "Please provide a concise summary of our conversation so far, capturing the key context, decisions made, and current state. Format this as a single comprehensive message that preserves all important information needed to continue our work. You do not need to recap the system message, as this will remain.",
  };

  // Get the current history for compaction
  const historyForCompaction = [...chatHistory, compactionPrompt];

  // Stream the compaction response
  const controller = new AbortController();

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
    const systemMessage = chatHistory.find((msg) => msg.role === "system");
    const compactedMessage: ChatCompletionMessageParam = {
      role: "assistant",
      content: `${COMPACTION_MARKER}\n${compactionContent}`,
    };

    // Set new chat history with only system message and compaction
    const compactedHistory = systemMessage
      ? [systemMessage, compactedMessage]
      : [compactedMessage];
    const compactionIndex = compactedHistory.length - 1;

    logger.debug("Chat history compacted", {
      originalLength: chatHistory.length,
      compactedLength: compactedHistory.length,
      compactionIndex,
    });

    return {
      compactedHistory,
      compactionIndex,
      compactionContent,
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
  chatHistory: ChatCompletionMessageParam[],
): number | null {
  const compactedIndex = chatHistory.findIndex(
    (msg) =>
      msg.role === "assistant" &&
      typeof msg.content === "string" &&
      msg.content.startsWith(COMPACTION_MARKER),
  );
  return compactedIndex === -1 ? null : compactedIndex;
}

/**
 * Gets the history to send to the LLM, taking compaction into account
 * @param fullHistory The complete chat history
 * @param compactionIndex The index of the compaction message, if any
 * @returns The history to send to the LLM
 */
export function getHistoryForLLM(
  fullHistory: ChatCompletionMessageParam[],
  compactionIndex: number | null,
): ChatCompletionMessageParam[] {
  if (compactionIndex === null || compactionIndex >= fullHistory.length) {
    return fullHistory;
  }

  // Include system message (if at index 0) and everything from compaction index forward
  const systemMessage =
    fullHistory[0]?.role === "system" ? fullHistory[0] : null;
  const messagesFromCompaction = fullHistory.slice(compactionIndex);

  return systemMessage && compactionIndex > 0
    ? [systemMessage, ...messagesFromCompaction]
    : messagesFromCompaction;
}
