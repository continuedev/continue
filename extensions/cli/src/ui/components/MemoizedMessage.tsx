import { Box, Text } from "ink";
import React, { memo } from "react";

import { MessageContent } from "../../../../../core/index.js";
import { ChatHistoryItemWithSplit } from "../hooks/useChat.splitMessage.helpers.js";
import {
  StyledSegmentRenderer,
  processMarkdownToSegments,
} from "../MarkdownProcessor.js";

/**
 * Formats message content for display, converting message parts array back to
 * user-friendly format with placeholders like [Image #1], [Pasted Text #1], etc.
 */
function formatMessageContentForDisplay(content: MessageContent): string {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return JSON.stringify(content);
  }

  // Convert message parts array back to display format with placeholders
  let displayText = "";
  let imageCounter = 0;

  for (const part of content) {
    if (part.type === "text") {
      displayText += part.text;
    } else if (part.type === "imageUrl") {
      imageCounter++;
      displayText += `[Image #${imageCounter}]`;
    } else {
      // Handle any other part types by converting to JSON
      displayText += JSON.stringify(part);
    }
  }

  return displayText;
}

interface MemoizedMessageProps {
  item: ChatHistoryItemWithSplit;
  index: number;
}

export const MemoizedMessage = memo<MemoizedMessageProps>(
  ({ item, index }) => {
    const {
      message,
      conversationSummary,
      splitMessage,
      styledSegments,
      toolResultRow,
    } = item;
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isAssistant = message.role === "assistant";

    // Handle system messages
    if (isSystem) {
      // TODO: Properly separate LLM system messages from UI informational messages
      // using discriminated union types. For now, skip displaying the first system
      // message which is typically the LLM's system prompt.
      if (index === 0) {
        return null;
      }

      return (
        <Box key={index} marginBottom={1}>
          <Text color="gray" italic>
            {message.content}
          </Text>
        </Box>
      );
    }

    // Handle conversation summary (compaction)
    if (conversationSummary) {
      return (
        <Box
          key={index}
          marginBottom={1}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
        />
      );
    }

    // Handle tool result rows (new architecture)
    if (toolResultRow) {
      const marginBottom = toolResultRow.isLastToolRow ? 1 : 0;

      return (
        <Box key={index} marginBottom={marginBottom}>
          <StyledSegmentRenderer segments={toolResultRow.rowData.segments} />
        </Box>
      );
    }

    // Handle regular messages
    // Never show streaming indicator for split messages, tool result rows, or messages with pre-processed segments
    const isStreaming =
      isAssistant &&
      !message.content &&
      !splitMessage &&
      !styledSegments &&
      !toolResultRow;

    // For split messages: only show bullet on first row and remove
    // spacing between rows so multiple rows appear as one message
    const isSplitMessage = splitMessage !== undefined;
    const shouldShowBullet = !isSplitMessage || splitMessage.isFirstRow;
    const marginBottom = isSplitMessage && !splitMessage.isLastRow ? 0 : 1;

    return (
      <Box key={index} marginBottom={marginBottom}>
        <Text color={isUser ? "blue" : "white"}>
          {shouldShowBullet ? "●" : " "}
        </Text>
        <Text> </Text>
        {isUser ? (
          <Text color="gray">
            {formatMessageContentForDisplay(message.content)}
          </Text>
        ) : (
          <StyledSegmentRenderer
            segments={
              styledSegments ||
              processMarkdownToSegments(
                formatMessageContentForDisplay(message.content),
              )
            }
          />
        )}
        {isStreaming && <Text color="gray">▋</Text>}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for better performance
    // Only re-render if these properties change
    const prevMessage = prevProps.item.message;
    const nextMessage = nextProps.item.message;

    return (
      prevMessage.content === nextMessage.content &&
      prevMessage.role === nextMessage.role &&
      prevProps.item.conversationSummary ===
        nextProps.item.conversationSummary &&
      JSON.stringify(prevProps.item.splitMessage) ===
        JSON.stringify(nextProps.item.splitMessage) &&
      JSON.stringify(prevProps.item.styledSegments) ===
        JSON.stringify(nextProps.item.styledSegments) &&
      JSON.stringify(prevProps.item.toolResultRow) ===
        JSON.stringify(nextProps.item.toolResultRow) &&
      prevProps.index === nextProps.index
    );
  },
);

MemoizedMessage.displayName = "MemoizedMessage";
