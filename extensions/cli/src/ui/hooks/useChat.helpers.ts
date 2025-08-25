import type { ChatHistoryItem, Session } from "../../../../../core/index.js";
import { initializeChatHistory } from "../../commands/chat.js";
import { compactChatHistory } from "../../compaction.js";
import {
  convertFromUnifiedHistory,
  convertToUnifiedHistory,
} from "../../messageConversion.js";
import { loadSession, saveSession } from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";

import { SlashCommandResult } from "./useChat.types.js";

/**
 * Initialize chat history with proper system message
 */
export async function initChatHistory(
  resume?: boolean,
  additionalRules?: string[],
): Promise<ChatHistoryItem[]> {
  if (resume) {
    const savedSession = loadSession();
    if (savedSession) {
      return savedSession.history;
    }
  }

  const history = await initializeChatHistory({
    resume,
    rule: additionalRules,
  });
  return history;
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
    saveSession(updatedSession);
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
 * Format message with attached files
 */
export function formatMessageWithFiles(
  message: string,
  attachedFiles: Array<{ path: string; content: string }>,
): string {
  if (attachedFiles.length === 0) {
    return message;
  }

  const fileContents = attachedFiles
    .map((file) => `\n\n<file path="${file.path}">\n${file.content}\n</file>`)
    .join("");

  return message + fileContents;
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
  const { handleAutoCompaction: coreAutoCompaction } = await import(
    "../../streamChatResponse.autoCompaction.js"
  );

  // Convert to legacy format for compaction
  const legacyHistory = convertFromUnifiedHistory(chatHistory);

  const result = await coreAutoCompaction(legacyHistory, model, llmApi, {
    isHeadless: false,
    callbacks: {
      setMessages: (updater: any) => {
        // Convert messages updates to chat history updates
        if (typeof updater === "function") {
          setChatHistory((prev) => {
            // For now, just return prev - compaction messages will be handled separately
            return prev;
          });
        }
      },
      setChatHistory: (updater: any) => {
        // Handle chat history updates
        if (typeof updater === "function") {
          setChatHistory((prev) => {
            const legacyPrev = convertFromUnifiedHistory(prev);
            const updated = updater(legacyPrev);
            return convertToUnifiedHistory(updated);
          });
        } else {
          setChatHistory(convertToUnifiedHistory(updater));
        }
      },
      setCompactionIndex,
    },
  });

  return {
    currentChatHistory: convertToUnifiedHistory(result.chatHistory),
    currentCompactionIndex: result.compactionIndex,
  };
}
