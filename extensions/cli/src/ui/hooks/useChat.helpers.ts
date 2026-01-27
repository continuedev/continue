import * as path from "node:path";

import type { ChatHistoryItem } from "core/index.js";
import { getLastNPathParts } from "core/util/uri.js";
import { v4 as uuidv4 } from "uuid";

import { logger } from "src/util/logger.js";

import { DEFAULT_SESSION_TITLE } from "../../constants/session.js";
import { loadSession, startNewSession } from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";

import { processImagePlaceholder } from "./useChat.imageProcessing.js";
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

interface ProcessSlashCommandResultOptions {
  result: SlashCommandResult;
  chatHistory: ChatHistoryItem[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  onShowConfigSelector: () => void;
  onShowModelSelector?: () => void;
  onShowUpdateSelector?: () => void;
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
  onShowConfigSelector,
  onShowUpdateSelector,
  onShowModelSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onClear,
}: ProcessSlashCommandResultOptions): string | null {
  if (result.exit) {
    import("../../util/exit.js").then(({ gracefulExit }) => gracefulExit(0));
  }

  if (result.openMcpSelector) {
    onShowMCPSelector?.();
    return null;
  }

  if (result.openUpdateSelector) {
    onShowUpdateSelector?.();
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

  if (result.diffContent) {
    setChatHistory((prev) => [
      ...prev,
      {
        message: {
          role: "system",
          content: `Diff:\n${result.diffContent}`,
        },
        contextItems: [],
      },
    ]);
    return null;
  } else if (result.output) {
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
    return null;
  }

  return result.newInput || null;
}

/**
 * Format message with attached files and images - returns a complete ChatHistoryItem
 */
export async function formatMessageWithFiles(
  message: string,
  attachedFiles: Array<{ path: string; content: string }>,
  imageMap?: Map<string, Buffer>,
): Promise<import("core/index.js").ChatHistoryItem> {
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

  // Process message content for images
  let messageContent: import("core/index.js").MessageContent = message;

  if (imageMap && imageMap.size > 0) {
    const messageParts: import("core/index.js").MessagePart[] = [];
    let textContent = message;

    // Replace image placeholders with image parts
    for (const [placeholder, originalImageBuffer] of imageMap.entries()) {
      const result = await processImagePlaceholder(
        placeholder,
        originalImageBuffer,
        textContent,
        messageParts,
      );
      textContent = result.textContent;
    }

    // Add any remaining text
    if (textContent) {
      messageParts.push({
        type: "text",
        text: textContent,
      });
    }

    // Use message parts if we have images, otherwise keep as string
    if (messageParts.length > 0) {
      messageContent = messageParts;
    }
  }

  return {
    message: {
      role: "user",
      content: messageContent,
    },
    contextItems,
  };
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
  remoteSessionId?: string;
  onShowConfigSelector: () => void;
  exit: () => void;
  onShowDiff?: (diffContent: string) => void;
  onShowStatusMessage?: (message: string) => void;
}

/**
 * Handle /diff command in remote mode
 */
async function handleRemoteDiffCommand(
  remoteUrl: string,
  onShowDiff?: (diffContent: string) => void,
): Promise<void> {
  try {
    const response = await fetch(`${remoteUrl}/diff`);
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const responseData = await response.json();
    const diffContent = responseData.diff || "";

    if (onShowDiff) {
      onShowDiff(diffContent);
    }
  } catch (error: any) {
    logger.error("Failed to fetch diff from remote server:", error);
    if (onShowDiff) {
      onShowDiff(`Error: Failed to fetch diff - ${error.message}`);
    }
  }
}

/**
 * Handle /apply command in remote mode
 */
async function handleRemoteApplyCommand(
  remoteUrl: string,
  onShowStatusMessage?: (message: string) => void,
): Promise<void> {
  try {
    const response = await fetch(`${remoteUrl}/diff`);
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.statusText}`);
    }

    const responseData = await response.json();
    const diffContent = responseData.diff || "";

    if (!diffContent || diffContent.trim() === "") {
      if (onShowStatusMessage) {
        onShowStatusMessage("No changes to apply");
      }
      return;
    }

    // Apply the diff using git apply
    const { execFileSync } = await import("child_process");

    try {
      execFileSync("git", ["apply"], {
        input: diffContent,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (onShowStatusMessage) {
        onShowStatusMessage(
          "✓ Successfully applied diff to local working tree",
        );
      }
    } catch (gitError: any) {
      if (onShowStatusMessage) {
        onShowStatusMessage(`✗ Failed to apply diff: ${gitError.message}`);
      }
    }
  } catch (error: any) {
    logger.error("Failed to fetch diff from remote server:", error);
    if (onShowStatusMessage) {
      onShowStatusMessage(`✗ Failed to fetch diff: ${error.message}`);
    }
  }
}

/**
 * Handle /accept command in remote mode
 * @param remoteUrl - The devbox tunnel URL
 * @param remoteSessionId - The agent session ID for backend API calls
 * @param isLocal - Whether to apply changes locally instead of pushing to GitHub
 * @param onShowStatusMessage - Callback to show status message
 */
async function handleRemoteAcceptCommand(
  remoteUrl: string,
  remoteSessionId: string | undefined,
  isLocal: boolean,
  onShowStatusMessage?: (message: string) => void,
): Promise<void> {
  const { post } = await import("../../util/apiClient.js");

  if (!remoteSessionId) {
    if (onShowStatusMessage) {
      onShowStatusMessage("✗ Session ID not available for accept command");
    }
    return;
  }

  try {
    if (isLocal) {
      // First fetch the diff from devbox
      const diffResponse = await fetch(`${remoteUrl}/diff`);
      if (!diffResponse.ok) {
        throw new Error(`Failed to fetch diff: ${diffResponse.statusText}`);
      }

      const responseData = await diffResponse.json();
      const diffContent = responseData.diff || "";

      if (!diffContent || diffContent.trim() === "") {
        if (onShowStatusMessage) {
          onShowStatusMessage("No changes to accept");
        }
        return;
      }

      // Mark as accepted in backend (without pushing to GitHub)
      await post(`agents/${remoteSessionId}/accept-local`);

      // Apply the diff locally
      const { execFileSync } = await import("child_process");
      try {
        execFileSync("git", ["apply"], {
          input: diffContent,
          stdio: ["pipe", "pipe", "pipe"],
        });

        if (onShowStatusMessage) {
          onShowStatusMessage(
            "✓ Changes accepted and applied locally. You can now commit them yourself.",
          );
        }
      } catch (gitError: any) {
        if (onShowStatusMessage) {
          onShowStatusMessage(
            `✓ Changes marked as accepted, but failed to apply locally: ${gitError.message}`,
          );
        }
      }
    } else {
      // Accept and push to GitHub
      await post(`agents/${remoteSessionId}/accept`);
      if (onShowStatusMessage) {
        onShowStatusMessage("✓ Changes accepted and pushed to GitHub");
      }
    }
  } catch (error: any) {
    logger.error("Failed to accept changes:", error);
    if (onShowStatusMessage) {
      onShowStatusMessage(`✗ Failed to accept changes: ${error.message}`);
    }
  }
}

/**
 * Handle /reject command in remote mode
 * @param remoteSessionId - The agent session ID for backend API calls
 * @param onShowStatusMessage - Callback to show status message
 */
async function handleRemoteRejectCommand(
  remoteSessionId: string | undefined,
  onShowStatusMessage?: (message: string) => void,
): Promise<void> {
  const { post } = await import("../../util/apiClient.js");

  if (!remoteSessionId) {
    if (onShowStatusMessage) {
      onShowStatusMessage("✗ Session ID not available for reject command");
    }
    return;
  }

  try {
    await post(`agents/${remoteSessionId}/reject`);
    if (onShowStatusMessage) {
      onShowStatusMessage("✓ Changes rejected");
    }
  } catch (error: any) {
    logger.error("Failed to reject changes:", error);
    if (onShowStatusMessage) {
      onShowStatusMessage(`✗ Failed to reject changes: ${error.message}`);
    }
  }
}

/**
 * Handle special TUI commands
 */
export async function handleSpecialCommands({
  message,
  isRemoteMode,
  remoteUrl,
  remoteSessionId,
  onShowConfigSelector,
  exit,
  onShowDiff,
  onShowStatusMessage,
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
    await handleRemoteExit(remoteUrl, exit);
    return true;
  }

  // Handle /diff command in remote mode - show overlay instead of adding to history
  if (
    isRemoteMode &&
    remoteUrl &&
    (trimmedMessage === "/diff" || trimmedMessage.startsWith("/diff "))
  ) {
    await handleRemoteDiffCommand(remoteUrl, onShowDiff);
    return true;
  }

  // Handle /apply command in remote mode - show temporary status message
  if (
    isRemoteMode &&
    remoteUrl &&
    (trimmedMessage === "/apply" || trimmedMessage.startsWith("/apply "))
  ) {
    await handleRemoteApplyCommand(remoteUrl, onShowStatusMessage);
    return true;
  }

  // Handle /accept command in remote mode
  if (
    isRemoteMode &&
    remoteUrl &&
    (trimmedMessage === "/accept" || trimmedMessage.startsWith("/accept "))
  ) {
    const isLocal = trimmedMessage.includes("--local");
    await handleRemoteAcceptCommand(
      remoteUrl,
      remoteSessionId,
      isLocal,
      onShowStatusMessage,
    );
    return true;
  }

  // Handle /reject command in remote mode
  if (
    isRemoteMode &&
    (trimmedMessage === "/reject" || trimmedMessage.startsWith("/reject "))
  ) {
    await handleRemoteRejectCommand(remoteSessionId, onShowStatusMessage);
    return true;
  }

  return false;
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
