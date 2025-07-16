import { Box, Text } from "ink";
import React from "react";
import MarkdownRenderer from "../MarkdownRenderer.js";
import ToolResultSummary from "../ToolResultSummary.js";

import { DisplayMessage } from "../types.js";

export function useMessageRenderer() {
  const renderMessage = (message: DisplayMessage, index: number) => {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
      switch (message.messageType) {
        case "tool-start":
          return (
            <Box key={index} marginBottom={1}>
              <Text color="white">○ {message.content}</Text>
            </Box>
          );

        case "tool-result":
          return (
            <Box key={index} marginBottom={1} flexDirection="column">
              <Box>
                <Text color="green">●</Text>
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
            <Box key={index} marginBottom={1}>
              <Text color="red" bold>
                ✗{" "}
              </Text>
              <Text color="red">Tool error: {message.content}</Text>
            </Box>
          );

        default:
          return (
            <Box key={index} marginBottom={1}>
              <Text color="gray" italic>
                {message.content}
              </Text>
            </Box>
          );
      }
    }

    return (
      <Box key={index} marginBottom={1}>
        <Text color={isUser ? "green" : "blue"}>●</Text>
        <Text> </Text>
        {isUser ? (
          <Text color="gray">{message.content}</Text>
        ) : (
          <MarkdownRenderer content={message.content} />
        )}
        {message.isStreaming && <Text color="gray">▋</Text>}
      </Box>
    );
  };

  return { renderMessage };
}
