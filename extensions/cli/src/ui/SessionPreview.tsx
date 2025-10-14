import type { ChatHistoryItem } from "core/index.js";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

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
  // Filter and format messages for preview
  const previewMessages = useMemo(() => {
    return chatHistory
      .filter((item) => item.message.role !== "system")
      .map((item) => ({
        role: item.message.role,
        content: formatMessageContent(item.message.content),
      }));
  }, [chatHistory]);

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
      {previewMessages.slice(0, 10).map((msg, index) => {
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
      {previewMessages.length > 10 && (
        <Text color="gray" italic>
          ... and {previewMessages.length - 10} more messages
        </Text>
      )}
    </Box>
  );
}
