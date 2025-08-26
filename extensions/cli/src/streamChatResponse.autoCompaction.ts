import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";
import React from "react";

import type { ChatHistoryItem } from "../../../core/index.js";

import { compactChatHistory } from "./compaction.js";
import {
  convertFromUnifiedHistory,
  convertToUnifiedHistory,
} from "./messageConversion.js";
import { createSession, saveSession } from "./session.js";
import { formatError } from "./util/formatError.js";
import { logger } from "./util/logger.js";
import { getAutoCompactMessage, shouldAutoCompact } from "./util/tokenizer.js";

interface AutoCompactionCallbacks {
  // For streaming mode
  onSystemMessage?: (message: string) => void;
  onContent?: (content: string) => void;

  // For TUI mode
  setMessages?: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setChatHistory?: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
  setCompactionIndex?: React.Dispatch<React.SetStateAction<number | null>>;

  // For headless mode - no callbacks needed, just return values
}

interface AutoCompactionOptions {
  isHeadless?: boolean;
  format?: "json";
  callbacks?: AutoCompactionCallbacks;
}

/**
 * Notify user about compaction start
 */
function notifyCompactionStart(
  message: string,
  isHeadless: boolean,
  callbacks?: AutoCompactionCallbacks,
) {
  if (isHeadless) return;

  if (callbacks?.onSystemMessage) {
    callbacks.onSystemMessage(message);
  } else if (callbacks?.setMessages) {
    // TUI mode - handled by caller
  }
}

/**
 * Handle successful compaction state updates
 */
function handleCompactionSuccess(
  result: any,
  isHeadless: boolean,
  callbacks?: AutoCompactionCallbacks,
) {
  if (isHeadless) return;

  const successMessage = "✓ Chat history auto-compacted successfully.";

  if (callbacks?.onSystemMessage) {
    callbacks.onSystemMessage(successMessage);
  } else if (
    callbacks?.setMessages &&
    callbacks?.setChatHistory &&
    callbacks?.setCompactionIndex
  ) {
    callbacks.setChatHistory(result.compactedHistory);
    callbacks.setCompactionIndex(result.compactionIndex);
    callbacks.setMessages((prev: ChatHistoryItem[]) => [
      ...prev,
      {
        message: {
          role: "system",
          content: successMessage,
        },
        contextItems: [],
      },
    ]);
  }
}

/**
 * Handle compaction error notification
 */
function handleCompactionError(
  error: any,
  isHeadless: boolean,
  callbacks?: AutoCompactionCallbacks,
) {
  const errorMessage = `Auto-compaction error: ${formatError(error)}`;
  logger.error(errorMessage);

  if (isHeadless) return;

  const warningMessage = `Warning: ${errorMessage}. Continuing without compaction...`;

  if (callbacks?.onSystemMessage) {
    callbacks.onSystemMessage(warningMessage);
  } else if (callbacks?.setMessages) {
    callbacks.setMessages((prev: ChatHistoryItem[]) => [
      ...prev,
      {
        message: {
          role: "system",
          content: warningMessage,
        },
        contextItems: [],
      },
    ]);
  }
}

/**
 * Unified auto-compaction handler for all modes (streaming, TUI, headless)
 * @param chatHistory Current chat history
 * @param model Model configuration
 * @param llmApi LLM API instance
 * @param options Configuration options for different usage contexts
 * @returns Updated chat history and compaction index, or original if no compaction needed
 */
export async function handleAutoCompaction(
  chatHistory: ChatCompletionMessageParam[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  options: AutoCompactionOptions = {},
): Promise<{
  chatHistory: ChatCompletionMessageParam[];
  compactionIndex: number | null;
}> {
  const { isHeadless = false, callbacks } = options;

  if (!model || !shouldAutoCompact(chatHistory, model)) {
    return { chatHistory, compactionIndex: null };
  }

  logger.info(
    `Auto-compaction triggered${isHeadless ? " in headless mode" : ""}`,
  );

  // Notify about compaction start
  notifyCompactionStart(getAutoCompactMessage(model), isHeadless, callbacks);

  try {
    // Convert to unified format for compaction
    const unifiedHistory = convertToUnifiedHistory(chatHistory);

    // Compact the history
    const result = await compactChatHistory(
      unifiedHistory,
      model,
      llmApi,
      isHeadless
        ? undefined
        : {
            onStreamContent: callbacks?.onContent,
            onStreamComplete: () => {},
          },
    );

    // Save the compacted session
    const session = createSession(result.compactedHistory);
    saveSession(session);

    // Handle success notification
    handleCompactionSuccess(result, isHeadless, callbacks);

    // Convert back to legacy format for return
    const compactedLegacyHistory = convertFromUnifiedHistory(
      result.compactedHistory,
    );

    return {
      chatHistory: compactedLegacyHistory,
      compactionIndex: result.compactionIndex,
    };
  } catch (error: any) {
    // Handle error notification
    handleCompactionError(error, isHeadless, callbacks);

    // Continue without compaction on error
    return { chatHistory, compactionIndex: null };
  }
}
