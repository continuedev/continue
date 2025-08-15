import { Box, Text } from "ink";
import React, { memo } from "react";

import { MarkdownRenderer } from "../MarkdownRenderer.js";
import { ToolResultSummary } from "../ToolResultSummary.js";
import { DisplayMessage } from "../types.js";

interface MemoizedMessageProps {
  message: DisplayMessage;
  index: number;
}

export const MemoizedMessage = memo<MemoizedMessageProps>(
  ({ message, index }) => {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
      switch (message.messageType) {
        case "tool-start":
          return (
            <Box key={index} marginLeft={1} marginBottom={1}>
              <Text color="white">○ {message.content}</Text>
            </Box>
          );

        case "tool-result":
          const isFailure =
            message.toolResult?.startsWith("Permission denied") ||
            message.toolResult?.startsWith("Error");
          return (
            <Box
              key={index}
              marginLeft={1}
              marginBottom={1}
              flexDirection="column"
            >
              <Box>
                <Text color={isFailure ? "red" : "green"}>●</Text>
                <Text> {message.content}</Text>
              </Box>
              <Box marginLeft={2}>
                <ToolResultSummary
                  toolName={message.toolName}
                  content={message.toolResult || ""}
                />
              </Box>
            </Box>
          );

        case "tool-error":
          return (
            <Box key={index} marginLeft={1} marginBottom={1}>
              <Text color="red" bold>
                ✗{" "}
              </Text>
              <Text color="red">Tool error: {message.content}</Text>
            </Box>
          );

        default:
          return (
            <Box key={index} marginLeft={1} marginBottom={1}>
              <Text color="gray" italic>
                {message.content}
              </Text>
            </Box>
          );
      }
    }

    // Special rendering for compaction messages
    if (message.messageType === "compaction") {
      return (
        <Box
          key={index}
          marginLeft={1}
          marginBottom={1}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
        />
      );
    }

    return (
      <Box key={index} marginLeft={1} marginBottom={1}>
        <Text color={isUser ? "green" : "magenta"}>●</Text>
        <Text> </Text>
        {isUser ? (
          <Text color="gray">{message.content}</Text>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
        {message.isStreaming && <Text color="gray">▋</Text>}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for better performance
    // Only re-render if these properties change
    return (
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role &&
      prevProps.message.messageType === nextProps.message.messageType &&
      prevProps.message.isStreaming === nextProps.message.isStreaming &&
      prevProps.message.toolName === nextProps.message.toolName &&
      prevProps.message.toolResult === nextProps.message.toolResult &&
      prevProps.message.permissionRequestId ===
        nextProps.message.permissionRequestId &&
      prevProps.index === nextProps.index
    );
  },
);

MemoizedMessage.displayName = "MemoizedMessage";
