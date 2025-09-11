import * as path from "node:path";

import type {
  ChatHistoryItem,
  MessageContent,
  MessagePart,
} from "core/index.js";
import { getLastNPathParts } from "core/util/uri.js";
import { v4 as uuidv4 } from "uuid";

import { logger } from "src/util/logger.js";

import { DEFAULT_SESSION_TITLE } from "../../constants/session.js";
import { loadSession, startNewSession } from "../../session.js";
import { posthogService } from "../../telemetry/posthogService.js";
import { telemetryService } from "../../telemetry/telemetryService.js";
import {
  processToolResultIntoRows,
  getToolCallTitleSegments,
} from "../ToolResultProcessor.js";

import { processImagePlaceholder } from "./useChat.imageProcessing.js";
import {
  splitMessageContent,
  type ChatHistoryItemWithSplit,
} from "./useChat.splitMessage.helpers.js";
import { SlashCommandResult } from "./useChat.types.js";

/**
 * Initialize chat history
 */
export async function initChatHistory(
  terminalWidth: number,
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
  onShowModelSelector,
  onShowMCPSelector,
  onShowSessionSelector,
  onClear,
}: ProcessSlashCommandResultOptions): string | null {
  if (result.exit) {
    process.exit(0);
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

  return false;
}

/**
 * Format message with attached files and images - returns multiple ChatHistoryItems (one per row)
 */
export async function formatMessageWithFiles(
  message: string,
  attachedFiles: Array<{ path: string; content: string }>,
  terminalWidth: number,
  imageMap?: Map<string, Buffer>,
): Promise<ChatHistoryItemWithSplit[]> {
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
  let messageContent: MessageContent = message;

  if (imageMap && imageMap.size > 0) {
    const messageParts: MessagePart[] = [];
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

  // Split the message content into multiple ChatHistoryItems
  return splitMessageContent(
    messageContent,
    "user",
    contextItems,
    terminalWidth,
  );
}

/**
 * Helper: Split assistant message content into terminal-width rows with styled segments
 */
function processAssistantMessageContent(
  item: ChatHistoryItem,
  terminalWidth: number,
): ChatHistoryItem[] {
  if (!item.message.content) {
    return [];
  }

  const splitMessages = splitMessageContent(
    item.message.content,
    "assistant",
    item.contextItems || [],
    terminalWidth,
  );

  return splitMessages.map((splitMsg) => ({
    ...item,
    ...splitMsg,
    toolCallStates: undefined, // Remove tool calls from content rows
  }));
}

/**
 * Helper: Create tool call header row with status indicator and pre-styled segments
 */
function createToolCallHeaderRow(
  item: ChatHistoryItem,
  toolState: any,
): ChatHistoryItemWithSplit {
  const toolName = toolState.toolCall.function.name;
  const toolArgs = toolState.parsedArgs;
  const isCompleted = toolState.status === "done";
  const isErrored =
    toolState.status === "errored" || toolState.status === "canceled";

  return {
    message: {
      role: "assistant",
      content: "",
    },
    contextItems: item.contextItems,
    toolResultRow: {
      toolCallId: toolState.toolCallId,
      toolName,
      rowData: {
        type: "header",
        segments: [
          {
            text: isCompleted || isErrored ? "●" : "○",
            styling: {
              color: isErrored
                ? "red"
                : isCompleted
                  ? "green"
                  : toolState.status === "generated"
                    ? "yellow"
                    : "white",
            },
          },
          { text: " ", styling: {} },
          ...getToolCallTitleSegments(toolName, toolArgs),
        ],
      },
      isFirstToolRow: true,
      isLastToolRow: !toolState.output || toolState.output.length === 0,
    },
  } as ChatHistoryItemWithSplit;
}

/**
 * Helper: Process tool output into multiple pre-styled rows
 */
function processToolCallOutput(
  item: ChatHistoryItem,
  toolState: any,
): ChatHistoryItem[] {
  if (!toolState.output || toolState.output.length === 0) {
    return [];
  }

  const toolName = toolState.toolCall.function.name;
  const isErrored =
    toolState.status === "errored" || toolState.status === "canceled";

  if (isErrored) {
    return [
      {
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: item.contextItems,
        toolResultRow: {
          toolCallId: toolState.toolCallId,
          toolName,
          rowData: {
            type: "content",
            segments: [
              { text: "  ", styling: {} }, // Indentation
              {
                text: toolState.output[0].content ?? "Tool execution failed",
                styling: { color: "red" },
              },
            ],
          },
          isFirstToolRow: false,
          isLastToolRow: true,
        },
      } as ChatHistoryItemWithSplit,
    ];
  }

  // Process tool output into multiple rows
  const content = toolState.output.map((o: any) => o.content).join("\n");
  const toolResultRows = processToolResultIntoRows({
    toolName,
    content,
  });

  return toolResultRows.map(
    (rowData, rowIndex) =>
      ({
        message: {
          role: "assistant",
          content: "",
        },
        contextItems: item.contextItems,
        toolResultRow: {
          toolCallId: toolState.toolCallId,
          toolName,
          rowData,
          isFirstToolRow: false,
          isLastToolRow: rowIndex === toolResultRows.length - 1,
        },
      }) as ChatHistoryItemWithSplit,
  );
}

/**
 * Helper: Process assistant messages that contain tool calls
 * Separates message content from tool results to prevent UI flickering
 */
function processAssistantWithToolCalls(
  item: ChatHistoryItem,
  terminalWidth: number,
): ChatHistoryItem[] {
  const processedHistory: ChatHistoryItem[] = [];

  // First, add the assistant message content if any (split if necessary)
  const contentRows = processAssistantMessageContent(item, terminalWidth);
  processedHistory.push(...contentRows);

  // Then, process each tool call into individual rows
  if (item.toolCallStates) {
    for (const toolState of item.toolCallStates) {
      // Create tool call header row
      const headerRow = createToolCallHeaderRow(item, toolState);
      processedHistory.push(headerRow);

      // Process tool output if present
      const outputRows = processToolCallOutput(item, toolState);
      processedHistory.push(...outputRows);
    }
  }

  return processedHistory;
}

/**
 * CORE ARCHITECTURE: Pre-process all chat content into terminal-width rows
 *
 * Anti-flickering strategy that processes all text and tool results upstream:
 * 1. Split all content into terminal-width-sized rows
 * 2. Pre-process markdown into styled segments with text/color formatting
 * 3. Expand tool calls into individual result rows with pre-styled segments
 * 4. Pass down small, pre-styled pieces that render instantly
 *
 * Each MemoizedMessage receives pre-computed segments, eliminating markdown
 * processing and preventing recomputation during terminal resizing.
 */
export function processHistoryForTerminalDisplay(
  history: ChatHistoryItem[],
  terminalWidth: number,
): ChatHistoryItem[] {
  const processedHistory: ChatHistoryItem[] = [];

  for (const item of history) {
    const itemWithSplit = item as ChatHistoryItemWithSplit;

    if (item.message.role === "assistant" && !itemWithSplit.splitMessage) {
      if (item.toolCallStates && item.toolCallStates.length > 0) {
        const toolCallRows = processAssistantWithToolCalls(item, terminalWidth);
        processedHistory.push(...toolCallRows);
      } else {
        // Regular assistant messages without tool calls - split normally
        const splitMessages = splitMessageContent(
          item.message.content,
          "assistant",
          item.contextItems || [],
          terminalWidth,
        );
        const splitMessagesWithProps = splitMessages.map((splitMsg) => ({
          ...item,
          ...splitMsg,
        }));
        processedHistory.push(...splitMessagesWithProps);
      }
    } else {
      // Keep other messages as-is (user, system, already split messages, tool result rows)
      processedHistory.push(item);
    }
  }

  return processedHistory;
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
