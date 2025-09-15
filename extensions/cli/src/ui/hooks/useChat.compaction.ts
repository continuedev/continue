import type { ChatHistoryItem, Session } from "core/index.js";

import { compactChatHistory } from "../../compaction.js";
import { updateSessionHistory } from "../../session.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";
import { shouldAutoCompact } from "../../util/tokenizer.js";

interface HandleCompactCommandOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentSession: Session;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session>>;
  setIsCompacting: (value: boolean) => void;
  setCompactionStartTime: (time: number | null) => void;
  setCompactionAbortController: (controller: AbortController | null) => void;
}

/**
 * Handle compaction command
 */
export async function handleCompactCommand({
  chatHistory,
  model,
  llmApi,
  setChatHistory,
  setCompactionIndex,
  currentSession,
  setCurrentSession,
  setIsCompacting,
  setCompactionStartTime,
  setCompactionAbortController,
}: HandleCompactCommandOptions): Promise<void> {
  // Create abort controller for cancellation support
  const compactionController = new AbortController();
  setCompactionAbortController(compactionController);

  // Start compaction status display
  setIsCompacting(true);
  setCompactionStartTime(Date.now());

  try {
    // Compact the chat history directly (already in unified format) with abort controller
    const result = await compactChatHistory(
      chatHistory,
      model,
      llmApi,
      undefined,
      compactionController,
    );

    // Check if operation was aborted before proceeding with success actions
    if (compactionController.signal.aborted) {
      return;
    }

    // Replace chat history with compacted version
    setChatHistory(result.compactedHistory);
    setCompactionIndex(result.compactionIndex);

    // Save the compacted session
    const updatedSession: Session = {
      ...currentSession,
      history: result.compactedHistory,
    };
    updateSessionHistory(result.compactedHistory);
    setCurrentSession(updatedSession);

    // Add success message to chat
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "Chat history compacted successfully.",
        },
        contextItems: [],
      },
    ]);
  } catch (error) {
    // Check if the error was due to abortion
    if (compactionController.signal.aborted) {
      logger.info("Manual compaction was cancelled by user");
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: "Compaction cancelled.",
          },
          contextItems: [],
        },
      ]);
    } else {
      logger.error("Compaction failed:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: `Compaction failed: ${formatError(error)}`,
          },
          contextItems: [],
        },
      ]);
    }
  } finally {
    // Stop compaction status display
    setIsCompacting(false);
    setCompactionStartTime(null);
    setCompactionAbortController(null);
  }
}

interface HandleAutoCompactionOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  compactionIndex: number | null;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  abortController?: AbortController;
}

/**
 * Handle auto-compaction when approaching context limit - TUI wrapper
 */
export async function handleAutoCompaction({
  chatHistory,
  model,
  llmApi,
  compactionIndex: _compactionIndex,
  setChatHistory,
  setCompactionIndex,
  abortController,
}: HandleAutoCompactionOptions): Promise<{
  currentChatHistory: ChatHistoryItem[];
  currentCompactionIndex: number | null;
}> {
  try {
    // Check if auto-compaction is needed
    // Check if auto-compaction is needed using ChatHistoryItem directly
    if (!model || !shouldAutoCompact(chatHistory, model)) {
      return {
        currentChatHistory: chatHistory,
        currentCompactionIndex: _compactionIndex,
      };
    }

    logger.info("Auto-compaction triggered for TUI mode");

    // Compact the unified history
    const result = await compactChatHistory(
      chatHistory,
      model,
      llmApi,
      undefined,
      abortController,
    );

    // Keep the system message and append the compaction summary
    // This replaces the old messages with a summary to reduce context size
    const systemMessage = chatHistory.find(
      (item) => item.message.role === "system",
    );

    const compactedMessage: ChatHistoryItem = {
      message: {
        role: "assistant" as const,
        content: result.compactionContent,
      },
      contextItems: [],
      conversationSummary: result.compactionContent, // Mark this as a summary
    };

    // Create new history with system message (if exists) and compaction summary
    const updatedHistory: ChatHistoryItem[] = systemMessage
      ? [systemMessage, compactedMessage]
      : [compactedMessage];

    // Add success message to the history that will be returned
    const successMessage: ChatHistoryItem = {
      message: {
        role: "system",
        content: "Chat history auto-compacted successfully.",
      },
      contextItems: [],
    };

    const finalHistory = [...updatedHistory, successMessage];

    setChatHistory(finalHistory);
    setCompactionIndex(updatedHistory.length - 1);

    return {
      currentChatHistory: finalHistory,
      currentCompactionIndex: updatedHistory.length - 1,
    };
  } catch (error) {
    logger.error("Auto-compaction failed:", error);

    // Add error message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: `Auto-compaction failed: ${formatError(error)}. Continuing without compaction...`,
        },
        contextItems: [],
      },
    ]);

    return {
      currentChatHistory: chatHistory,
      currentCompactionIndex: null,
    };
  }
}
