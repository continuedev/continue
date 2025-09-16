import { Box, Text } from "ink";
import React, { memo } from "react";

import type { ChatHistoryLine } from "../utils/chatHistoryLineSplitter.js";
import { createStyledTextFromSegments } from "../utils/chatHistoryLineSplitter.js";

interface LineBasedMessageProps {
  item: ChatHistoryLine;
  index: number;
}

export const LineBasedMessage = memo<LineBasedMessageProps>(
  ({ item, index }) => {
    const { message, styledSegments } = item;
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    // console.log(`[DEBUG] LineBasedMessage ${index}: originalIndex=${item.originalIndex}, lineIndex=${item.lineIndex}, content="${message.content.slice(0, 50)}...", segments=${styledSegments?.length || 0}`);

    // Handle system messages
    if (isSystem) {
      // Skip displaying the first system message (typically LLM system prompt)
      if (item.originalIndex === 0) {
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

    // Handle regular messages - let ANSI stream provide all formatting including spacing
    return (
      <Box key={index}>
        {/* DEBUG: Add X prefix to every other line */}
        {/* {index % 2 === 1 && <Text color="red">X </Text>} */}

        {/* Render content with styling if available - all formatting comes from ANSI stream */}
        {message.content === '' ? (
          // Render blank lines as empty space (blank lines now have empty segments)
          <Text> </Text>
        ) : styledSegments && styledSegments.length > 0 ? (
          // Use ANSI-parsed styling information
          <Box>
            {createStyledTextFromSegments(styledSegments)}
          </Box>
        ) : (
          // Fallback to simple text rendering
          <Text color={isUser ? "gray" : "white"}>
            {message.content}
          </Text>
        )}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for performance
    const prevMessage = prevProps.item.message;
    const nextMessage = nextProps.item.message;

    return (
      prevMessage.content === nextMessage.content &&
      prevMessage.role === nextMessage.role &&
      prevProps.item.originalIndex === nextProps.item.originalIndex &&
      prevProps.item.lineIndex === nextProps.item.lineIndex &&
      prevProps.index === nextProps.index
    );
  }
);