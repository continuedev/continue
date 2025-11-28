import type { ChatHistoryItem } from "core/index.js";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { defaultBoxStyles } from "./styles.js";

interface SessionPreviewProps {
  chatHistory: ChatHistoryItem[];
  sessionTitle: string;
}

function formatMessageContent(content: string | any): string {
  if (typeof content === "string") {
    return content;
  } else if (Array.isArray(content)) {
    // For array content, find the first text part
    const textPart = content.find((part: any) => part.type === "text");
    return textPart && "text" in textPart
      ? textPart.text
      : "(multimodal message)";
  }
  return "(unknown content type)";
}

export function SessionPreview({
  chatHistory,
  sessionTitle,
}: SessionPreviewProps) {
  const { rows: terminalHeight } = useTerminalSize();

  // Filter and format messages for preview
  const previewMessages = useMemo(() => {
    return chatHistory
      .filter((item) => {
        // Skip system messages
        if (item.message.role === "system") return false;

        // Skip empty assistant messages
        if (item.message.role === "assistant") {
          const content = formatMessageContent(item.message.content);
          if (!content || content.trim() === "") return false;
        }

        return true;
      })
      .map((item) => ({
        role: item.message.role,
        content: formatMessageContent(item.message.content),
      }));
  }, [chatHistory]);

  // Calculate how many messages we can display based on terminal height
  const maxMessages = useMemo(() => {
    // Account for:
    // - Box border (top + bottom): 2 lines
    // - Box padding (top + bottom): 2 lines
    // - Title line: 1 line
    // - Empty line after title: 1 line
    // - "... and X more messages" line: 1 line
    // - Each message: ~4 lines (role + content + marginBottom)
    const OVERHEAD = 7;
    const LINES_PER_MESSAGE = 4;
    const availableHeight = Math.max(1, terminalHeight - OVERHEAD);
    return Math.max(1, Math.floor(availableHeight / LINES_PER_MESSAGE));
  }, [terminalHeight]);

  if (previewMessages.length === 0) {
    return (
      <Box {...defaultBoxStyles("blue")} flexDirection="column" width="100%">
        <Text color="blue" bold>
          Preview
        </Text>
        <Text color="gray">(no messages)</Text>
      </Box>
    );
  }

  return (
    <Box {...defaultBoxStyles("blue")} flexDirection="column" width="100%">
      <Text color="blue" bold>
        {sessionTitle}
      </Text>
      <Text> </Text>
      {previewMessages.slice(0, maxMessages).map((msg, index) => {
        const roleColor = msg.role === "user" ? "green" : "cyan";
        const roleLabel = msg.role === "user" ? "You" : "Assistant";
        // Truncate long messages for preview
        const truncatedContent =
          msg.content.length > 150
            ? msg.content.substring(0, 150) + "..."
            : msg.content;

        return (
          <Box key={index} flexDirection="column" marginBottom={1}>
            <Text color={roleColor} bold>
              {roleLabel}:
            </Text>
            <Text wrap="truncate-end">{truncatedContent}</Text>
          </Box>
        );
      })}
      {previewMessages.length > maxMessages && (
        <Text color="gray" italic>
          ... and {previewMessages.length - maxMessages} more messages
        </Text>
      )}
    </Box>
  );
}
