import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { initializeChatHistory } from "../../commands/chat.js";
import { compactChatHistory } from "../../compaction.js";
import { loadSession, saveSession } from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import { formatError } from "../../util/formatError.js";
import { logger } from "../../util/logger.js";
import { DisplayMessage } from "../types.js";

import { SlashCommandResult } from "./useChat.types.js";

/**
 * Initialize chat history with proper system message
 */
export async function initChatHistory(
  resume?: boolean,
  additionalRules?: string[],
): Promise<ChatCompletionMessageParam[]> {
  if (resume) {
    const savedHistory = loadSession();
    if (savedHistory) {
      return savedHistory;
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
  chatHistory: ChatCompletionMessageParam[];
  model: any;
  llmApi: any;
  setChatHistory: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setCompactionIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Handle compaction command
 */
export async function handleCompactCommand({
  chatHistory,
  model,
  llmApi,
  setChatHistory,
  setMessages,
  setCompactionIndex,
}: HandleCompactCommandOptions): Promise<void> {
  setMessages((prev) => [
    ...prev,
    {
      role: "system",
      content: "Compacting chat history...",
      messageType: "system" as const,
    },
  ]);

  try {
    const result = await compactChatHistory(chatHistory, model, llmApi);

    // Replace chat history with compacted version
    setChatHistory(result.compactedHistory);
    setCompactionIndex(result.compactionIndex);

    // Save the compacted session
    saveSession(result.compactedHistory);

    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: "Chat history compacted successfully.",
        messageType: "system" as const,
      },
    ]);
  } catch (error) {
    logger.error("Compaction failed:", error);
    setMessages((prev) => [
      ...prev,
      {
        role: "system",
        content: `Compaction failed: ${formatError(error)}`,
        messageType: "system" as const,
      },
    ]);
  }
}

interface ProcessSlashCommandResultOptions {
  result: SlashCommandResult;
  chatHistory: ChatCompletionMessageParam[];
  setChatHistory: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
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
  setMessages,
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
    const systemMessage = chatHistory.find((msg) => msg.role === "system");
    const newHistory = systemMessage ? [systemMessage] : [];
    setChatHistory(newHistory);
    setMessages([]);

    // Reset intro message state to show it again after clearing
    if (onClear) {
      onClear();
    }

    if (result.output) {
      setMessages([
        {
          role: "system",
          content: result.output,
          messageType: "system" as const,
        },
      ]);
    }
    return null;
  }

  if (result.output) {
    setMessages((prev) => [
      ...prev,
      {
        role: "system" as const,
        content: result.output || "",
        messageType: "system" as const,
      } as DisplayMessage,
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
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
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
  setMessages,
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
    await handleRemoteExit(remoteUrl, setMessages, exit);
    return true;
  }

  return false;
}

interface HandleAutoCompactionOptions {
  chatHistory: ChatCompletionMessageParam[];
  model: any;
  llmApi: any;
  compactionIndex: number | null;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setChatHistory: React.Dispatch<
    React.SetStateAction<ChatCompletionMessageParam[]>
  >;
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
  setMessages,
  setChatHistory,
  setCompactionIndex,
}: HandleAutoCompactionOptions): Promise<{
  currentChatHistory: ChatCompletionMessageParam[];
  currentCompactionIndex: number | null;
}> {
  if (!llmApi) {
    throw new Error("LLM API is not available for auto-compaction");
  }

  const { handleAutoCompaction: coreAutoCompaction } = await import(
    "../../streamChatResponse.autoCompaction.js"
  );

  const result = await coreAutoCompaction(chatHistory, model, llmApi, {
    isHeadless: false,
    callbacks: {
      setMessages,
      setChatHistory,
      setCompactionIndex,
    },
  });

  return {
    currentChatHistory: result.chatHistory,
    currentCompactionIndex: result.compactionIndex,
  };
}
