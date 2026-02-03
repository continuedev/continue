import { ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatHistoryItem } from "core/index.js";
import type { ChatCompletionTool } from "openai/resources/chat/completions.mjs";
import React from "react";

import {
  compactChatHistory,
  getAutoCompactMessage,
  shouldAutoCompact,
} from "../compaction.js";
import { updateSessionHistory } from "../session.js";
import { formatError } from "../util/formatError.js";
import { logger } from "../util/logger.js";

interface AutoCompactionCallbacks {
  // For streaming mode
  onSystemMessage?: (message: string) => void;
  onContent?: (content: string) => void;

  // For TUI mode
  setMessages?: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setChatHistory?: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex?: React.Dispatch<React.SetStateAction<number | null>>;

  // For headless mode - no callbacks needed, just return values
}

interface AutoCompactionOptions {
  isHeadless?: boolean;
  format?: "json";
  callbacks?: AutoCompactionCallbacks;
  systemMessage?: string;
  tools?: ChatCompletionTool[];
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

  const successMessage = "Chat history auto-compacted successfully.";

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
  chatHistory: ChatHistoryItem[],
  model: ModelConfig,
  llmApi: BaseLlmApi,
  options: AutoCompactionOptions = {},
): Promise<{
  chatHistory: ChatHistoryItem[];
  compactionIndex: number | null;
  wasCompacted: boolean;
}> {
  const {
    isHeadless = false,
    callbacks,
    systemMessage: providedSystemMessage,
    tools,
  } = options;

  if (
    !model ||
    !shouldAutoCompact({
      chatHistory,
      model,
      systemMessage: providedSystemMessage,
      tools,
    })
  ) {
    return { chatHistory, compactionIndex: null, wasCompacted: false };
  }

  logger.info(
    `Auto-compaction triggered${isHeadless ? " in headless mode" : ""}`,
  );

  // Notify about compaction start
  notifyCompactionStart(getAutoCompactMessage(model), isHeadless, callbacks);

  try {
    // Get system message to calculate its token count for compaction pruning
    // Use provided message if available, otherwise fetch it (for backward compatibility)
    const systemMessage =
      providedSystemMessage ??
      (async () => {
        const { services } = await import("../services/index.js");
        return services.systemMessage.getSystemMessage(
          services.toolPermissions.getState().currentMode,
        );
      })();
    const resolvedSystemMessage =
      typeof systemMessage === "string" ? systemMessage : await systemMessage;

    const { countChatHistoryItemTokens } = await import("../util/tokenizer.js");
    const systemMessageTokens = countChatHistoryItemTokens(
      {
        message: {
          role: "system",
          content: resolvedSystemMessage,
        },
        contextItems: [],
      },
      model,
    );

    // Compact the history
    const result = await compactChatHistory(chatHistory, model, llmApi, {
      callbacks: isHeadless
        ? undefined
        : {
            onStreamContent: callbacks?.onContent,
            onStreamComplete: () => {},
          },
      systemMessageTokens,
    });

    // Save the compacted session
    updateSessionHistory(result.compactedHistory);

    // Handle success notification
    handleCompactionSuccess(result, isHeadless, callbacks);

    return {
      chatHistory: result.compactedHistory,
      compactionIndex: result.compactionIndex,
      wasCompacted: true,
    };
  } catch (error: any) {
    // Handle error notification
    handleCompactionError(error, isHeadless, callbacks);

    // Continue without compaction on error
    return { chatHistory, compactionIndex: null, wasCompacted: false };
  }
}
