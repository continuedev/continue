import type { ChatHistoryItem, Session } from "core/index.js";

import { compactChatHistory } from "../../compaction.js";
import { updateSessionHistory } from "../../session.js";
import { handleAutoCompaction as coreHandleAutoCompaction } from "../../stream/streamChatResponse.autoCompaction.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";

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
    const result = await compactChatHistory(chatHistory, model, llmApi, {
      abortController: compactionController,
    });

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
  abortController: _abortController,
}: HandleAutoCompactionOptions): Promise<{
  currentChatHistory: ChatHistoryItem[];
  currentCompactionIndex: number | null;
}> {
  // Delegate to core handleAutoCompaction which decides whether compaction is needed
  // Note: TUI mode doesn't have access to tools/systemMessage at this point,
  // so the core function uses a simplified check.
  const result = await coreHandleAutoCompaction(chatHistory, model, llmApi, {
    isHeadless: false,
    callbacks: {
      setChatHistory,
      setCompactionIndex,
    },
  });

  if (!result.wasCompacted) {
    return {
      currentChatHistory: chatHistory,
      currentCompactionIndex: _compactionIndex,
    };
  }

  return {
    currentChatHistory: result.chatHistory,
    currentCompactionIndex: result.compactionIndex,
  };
}
