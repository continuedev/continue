import * as path from "node:path";

import type { ChatHistoryItem, Session } from "core/index.js";
import { getLastNPathParts } from "core/util/uri.js";
import { v4 as uuidv4 } from "uuid";

import { compactChatHistory } from "../../compaction.js";
import { DEFAULT_SESSION_TITLE } from "../../constants/session.js";
import {
  loadSession,
  updateSessionHistory,
  startNewSession,
} from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";
import { shouldAutoCompact } from "../../util/tokenizer.js";

import { SlashCommandResult } from "./useChat.types.js";

/**
 * Initialize chat history
 */
export async function initChatHistory(
  resume?: boolean,
  _additionalRules?: string[],
): Promise<ChatHistoryItem[]> {
  if (resume) {
    const savedSession = loadSession();
    if (savedSession) {
      return savedSession.history;
    }
  }

  // Start with empty history - system message will be injected when needed
  return [];
}

/**
 * Handle /config command
 */
export function handleConfigCommand(onShowConfigSelector: () => void): void {
  posthogService.capture("useSlashCommand", {
    name: "config",
  });
  onShowConfigSelector();
}

interface HandleCompactCommandOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  currentSession: Session;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session>>;
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
}: HandleCompactCommandOptions): Promise<void> {
  // Add compacting message
  setChatHistory((prev) => [
    ...prev,
    {
      message: {
        role: "system",
        content: "Compacting chat history...",
      },
      contextItems: [],
    },
  ]);

  try {
    // Compact the chat history directly (already in unified format)
    const result = await compactChatHistory(chatHistory, model, llmApi);

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
}

interface ProcessSlashCommandResultOptions {
  result: SlashCommandResult;
  chatHistory: ChatHistoryItem[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  exit: () => void;
  onShowConfigSelector: () => void;
  onShowModelSelector?: () => void;
  onShowMCPSelector?: () => void;
  onShowSessionSelector?: () => void;
  onClear?: () => void;
}

/**
 * Process slash command results
 */
export function processSlashCommandResult({
  result,
  chatHistory,
  setChatHistory,
  exit,
  onShowConfigSelector,
  onShowModelSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onClear,
}: ProcessSlashCommandResultOptions): string | null {
  if (result.exit) {
    exit();
    return null;
  }

  if (result.openMcpSelector) {
    onShowMCPSelector?.();
    return null;
  }

  if (result.openConfigSelector) {
    onShowConfigSelector();
    return null;
  }

  if (result.openModelSelector && onShowModelSelector) {
    onShowModelSelector();
    return null;
  }

  if (result.openSessionSelector && onShowSessionSelector) {
    onShowSessionSelector();
    return null;
  }

  if (result.clear) {
    const systemMessage = chatHistory.find(
      (item) => item.message.role === "system",
    );
    const newHistory = systemMessage ? [systemMessage] : [];

    // Start a new session with a new sessionId
    startNewSession(newHistory);

    setChatHistory(newHistory);

    // Reset intro message state to show it again after clearing
    if (onClear) {
      onClear();
    }

    if (result.output) {
      setChatHistory([
        {
          message: {
            role: "system",
            content: result.output,
          },
          contextItems: [],
        },
      ]);
    }
    return null;
  }

  if (result.output) {
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: result.output || "",
        },
        contextItems: [],
      },
    ]);
  }

  return result.newInput || null;
}

/**
 * Format message with attached files - returns message text and context items separately
 */
export function formatMessageWithFiles(
  message: string,
  attachedFiles: Array<{ path: string; content: string }>,
): {
  messageText: string;
  contextItems: import("core/index.js").ContextItemWithId[];
} {
  if (attachedFiles.length === 0) {
    return { messageText: message, contextItems: [] };
  }

  // Convert attached files to context items
  const contextItems = attachedFiles.map((file) => ({
    id: {
      providerTitle: "file",
      itemId: uuidv4(),
    },
    content: file.content,
    name: path.basename(file.path),
    description: getLastNPathParts(file.path, 2),
    uri: {
      type: "file" as const,
      value: `file://${file.path}`,
    },
  }));

  // Keep the original message text unchanged (preserving @filename references)
  return { messageText: message, contextItems };
}

/**
 * Track telemetry for user message
 */
export function trackUserMessage(message: string, model?: any): void {
  telemetryService.startActiveTime();
  telemetryService.logUserPrompt(message.length, message);
  posthogService.capture("chat", {
    model: model?.name,
    provider: model?.provider,
  });
}

interface HandleSpecialCommandsOptions {
  message: string;
  isRemoteMode: boolean;
  remoteUrl?: string;
  onShowConfigSelector: () => void;
  exit: () => void;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
}

/**
 * Handle special TUI commands
 */
export async function handleSpecialCommands({
  message,
  isRemoteMode,
  remoteUrl,
  onShowConfigSelector,
  exit,
  setChatHistory,
}: HandleSpecialCommandsOptions): Promise<boolean> {
  const trimmedMessage = message.trim();

  // Special handling for /config command in TUI
  if (trimmedMessage === "/config") {
    handleConfigCommand(onShowConfigSelector);
    return true;
  }

  // Handle /exit command in remote mode
  if (isRemoteMode && remoteUrl && trimmedMessage === "/exit") {
    const { handleRemoteExit } = await import("./useChat.remote.helpers.js");
    await handleRemoteExit(remoteUrl, setChatHistory, exit);
    return true;
  }

  return false;
}

interface HandleAutoCompactionOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  compactionIndex: number | null;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
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

    // Add compacting message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "Auto-compacting chat history...",
        },
        contextItems: [],
      },
    ]);

    // Compact the unified history
    const result = await compactChatHistory(chatHistory, model, llmApi);

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

    setChatHistory(updatedHistory);
    setCompactionIndex(updatedHistory.length - 1);

    // Add success message
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: "✓ Chat history auto-compacted successfully.",
        },
        contextItems: [],
      },
    ]);

    return {
      currentChatHistory: updatedHistory,
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

/**
 * Generate a title for the session based on the first assistant response
 */
export async function generateSessionTitle(
  assistantResponse: string,
  llmApi: any,
  model: any,
  currentSessionTitle?: string,
): Promise<string | undefined> {
  // Only generate title for untitled sessions
  if (currentSessionTitle && currentSessionTitle !== DEFAULT_SESSION_TITLE) {
    return undefined;
  }

  if (!assistantResponse || !llmApi || !model) {
    return undefined;
  }

  try {
    const { ChatDescriber } = await import("core/util/chatDescriber.js");
    const generatedTitle = await ChatDescriber.describeWithBaseLlmApi(
      llmApi,
      model,
      assistantResponse,
    );

    logger.debug("Generated session title", {
      original: currentSessionTitle,
      generated: generatedTitle,
    });

    return generatedTitle;
  } catch (error) {
    logger.error("Failed to generate session title:", error);
    return undefined;
  }
}
