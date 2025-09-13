import type { ChatHistoryItem, MessageContent } from "core/index.js";

import { breakTextIntoRows } from "../hooks/useChat.splitLines.helpers.js";
import type { MessageRow, StyledSegment } from "../types/messageTypes.js";

import {
  processMarkdownToSegments,
  splitStyledSegmentsIntoRows,
} from "./markdownProcessor.js";
import {
  processToolResultIntoRows,
  getToolCallTitleSegments,
} from "./toolResultProcessor.js";

/**
 * Convert all chat history to unified MessageRow format
 *
 * This replaces processHistoryForTerminalDisplay and creates the unified
 * MessageRow architecture where everything is rendered through segments.
 */
export function processHistoryToMessageRows(
  history: ChatHistoryItem[],
  terminalWidth: number,
): MessageRow[] {
  const messageRows: MessageRow[] = [];

  for (const item of history) {
    if (item.message.role === "user") {
      const userRows = processUserMessage(item, terminalWidth);
      messageRows.push(...userRows);
    } else if (item.message.role === "assistant") {
      if (item.toolCallStates && item.toolCallStates.length > 0) {
        const assistantWithToolRows = processAssistantWithToolCalls(
          item,
          terminalWidth,
        );
        messageRows.push(...assistantWithToolRows);
      } else {
        const assistantRows = processAssistantMessage(item, terminalWidth);
        messageRows.push(...assistantRows);
      }
    } else if (item.message.role === "system") {
      const systemRows = processSystemMessage(item, terminalWidth);
      messageRows.push(...systemRows);
    }
  }

  return messageRows;
}

/**
 * Process user messages into MessageRow format
 */
function processUserMessage(
  item: ChatHistoryItem,
  terminalWidth: number,
): MessageRow[] {
  const content = processMessageContent(item.message.content);

  // Simple text splitting for user messages (no markdown processing)
  const textRows = breakTextIntoRows(content, terminalWidth);

  return textRows.map((text, index) => ({
    role: "user" as const,
    rowType: "content" as const,
    segments: [{ text, styling: { color: "gray" } }],
    showBullet: index === 0, // Only show bullet on first row
    marginBottom: index === textRows.length - 1 ? 1 : 0, // Only add margin after last row
  }));
}

/**
 * Process assistant messages into MessageRow format
 */
function processAssistantMessage(
  item: ChatHistoryItem,
  terminalWidth: number,
): MessageRow[] {
  const content = processMessageContent(item.message.content);

  // Process markdown into styled segments then split into rows
  const styledSegments = processMarkdownToSegments(content);
  const segmentRows = splitStyledSegmentsIntoRows(
    styledSegments,
    terminalWidth,
  );

  return segmentRows.map((segments, index) => ({
    role: "assistant" as const,
    rowType: "content" as const,
    segments,
    showBullet: index === 0, // Only show bullet on first row
    marginBottom: index === segmentRows.length - 1 ? 1 : 0, // Only add margin after last row
  }));
}

/**
 * Process system messages into MessageRow format
 */
function processSystemMessage(
  item: ChatHistoryItem,
  terminalWidth: number,
): MessageRow[] {
  const content = processMessageContent(item.message.content);

  // Simple text splitting for system messages
  const textRows = breakTextIntoRows(content, terminalWidth);

  return textRows.map((text, index) => ({
    role: "system" as const,
    rowType: "content" as const,
    segments: [{ text, styling: { color: "yellow" } }],
    showBullet: index === 0,
    marginBottom: index === textRows.length - 1 ? 1 : 0,
  }));
}

/**
 * Process assistant messages with tool calls into MessageRow format
 */
function processAssistantWithToolCalls(
  item: ChatHistoryItem,
  terminalWidth: number,
): MessageRow[] {
  const messageRows: MessageRow[] = [];

  // First, add any assistant message content
  if (item.message.content) {
    const contentRows = processAssistantMessage(item, terminalWidth);
    messageRows.push(...contentRows);
  }

  // Then, process each tool call
  if (item.toolCallStates) {
    for (const toolState of item.toolCallStates) {
      // Create tool call header
      const headerRow = createToolCallHeaderRow(toolState);
      messageRows.push(headerRow);

      // Create tool output rows
      const outputRows = createToolOutputRows(toolState);
      messageRows.push(...outputRows);
    }
  }

  return messageRows;
}

/**
 * Create tool call header row
 */
function createToolCallHeaderRow(toolState: any): MessageRow {
  const toolName = toolState.toolCall.function.name;
  const toolArgs = toolState.parsedArgs;
  const isCompleted = toolState.status === "done";
  const isErrored =
    toolState.status === "errored" || toolState.status === "canceled";

  const statusSegments: StyledSegment[] = [
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
  ];

  return {
    role: "tool-result",
    rowType: "header",
    segments: statusSegments,
    showBullet: false, // Tool headers don't need bullets
    marginBottom: 0, // No margin after headers
    toolMeta: {
      toolCallId: toolState.toolCallId,
      toolName,
    },
  };
}

/**
 * Create tool output rows
 */
function createToolOutputRows(toolState: any): MessageRow[] {
  if (!toolState.output || toolState.output.length === 0) {
    return [];
  }

  const toolName = toolState.toolCall.function.name;
  const isErrored =
    toolState.status === "errored" || toolState.status === "canceled";

  if (isErrored) {
    return [
      {
        role: "tool-result" as const,
        rowType: "content" as const,
        segments: [
          { text: "  ", styling: {} }, // Indentation
          {
            text: toolState.output[0].content ?? "Tool execution failed",
            styling: { color: "red" },
          },
        ],
        showBullet: false,
        marginBottom: 1, // Add margin after error output
        toolMeta: {
          toolCallId: toolState.toolCallId,
          toolName,
        },
      },
    ];
  }

  // Process successful tool output
  const content = toolState.output.map((o: any) => o.content).join("\n");
  const toolResultRows = processToolResultIntoRows({ toolName, content });

  return toolResultRows.map((rowData, rowIndex) => ({
    role: "tool-result" as const,
    rowType: "content" as const,
    segments: rowData.segments,
    showBullet: false,
    marginBottom: rowIndex === toolResultRows.length - 1 ? 1 : 0, // Only add margin after last row
    toolMeta: {
      toolCallId: toolState.toolCallId,
      toolName,
    },
  }));
}

/**
 * Convert MessageContent to string representation
 */
function processMessageContent(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return JSON.stringify(content);
  }

  // Handle MessagePart[] array - convert to display format
  let displayText = "";
  let imageCounter = 0;

  for (const part of content) {
    if (part.type === "text") {
      displayText += part.text;
    } else if (part.type === "imageUrl") {
      imageCounter++;
      displayText += `[Image #${imageCounter}]`;
    } else {
      // Handle any other part types
      displayText += JSON.stringify(part);
    }
  }

  return displayText;
}
