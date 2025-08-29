import { Box, Text } from "ink";
import React, { memo } from "react";

import { ToolCallTitle } from "src/tools/ToolCallTitle.js";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { MarkdownRenderer } from "../MarkdownRenderer.js";
import { ToolResultSummary } from "../ToolResultSummary.js";

interface MemoizedMessageProps {
  item: ChatHistoryItem;
  index: number;
}

export const MemoizedMessage = memo<MemoizedMessageProps>(
  ({ item, index }) => {
    const { message, toolCallStates, conversationSummary } = item;
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

    // Handle tool calls
    if (toolCallStates && toolCallStates.length > 0) {
      return (
        <Box key={index} flexDirection="column">
          {/* Render assistant message content if any */}
          {message.content && (
            <Box marginBottom={1}>
              <Text color="white">●</Text>
              <Text> </Text>
              <MarkdownRenderer
                content={
                  typeof message.content === "string"
                    ? message.content
                    : JSON.stringify(message.content)
                }
              />
            </Box>
          )}

          {/* Render tool calls */}
          {toolCallStates.map((toolState) => {
            const toolName = toolState.toolCall.function.name;
            const toolArgs = toolState.parsedArgs;
            const isCompleted = toolState.status === "done";
            const isErrored =
              toolState.status === "errored" || toolState.status === "canceled";

            return (
              <Box
                key={toolState.toolCallId}
                flexDirection="column"
                marginBottom={1}
              >
                <Box>
                  <Text
                    color={isErrored ? "red" : isCompleted ? "green" : "white"}
                  >
                    {isCompleted || isErrored ? "●" : "○"}
                  </Text>
                  <Text color="white">
                    {" "}
                    <ToolCallTitle toolName={toolName} args={toolArgs} />
                  </Text>
                </Box>

                {isErrored ? (
                  <Box marginLeft={2}>
                    <Text color="red">
                      {toolState.output?.[0].content ?? "Tool execution failed"}
                    </Text>
                  </Box>
                ) : (
                  toolState.output &&
                  toolState.output.length > 0 && (
                    <Box marginLeft={2}>
                      <ToolResultSummary
                        toolName={toolName}
                        content={toolState.output
                          .map((o) => o.content)
                          .join("\n")}
                      />
                    </Box>
                  )
                )}
              </Box>
            );
          })}
        </Box>
      );
    }

    // Handle regular messages
    const isStreaming = isAssistant && !message.content && !toolCallStates;

    return (
      <Box key={index} marginBottom={1}>
        <Text color={isUser ? "blue" : "white"}>●</Text>
        <Text> </Text>
        {isUser ? (
          <Text color="gray">
            {typeof message.content === "string"
              ? message.content
              : JSON.stringify(message.content)}
          </Text>
        ) : (
          <MarkdownRenderer
            content={
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content)
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
    const prevToolStates = prevProps.item.toolCallStates;
    const nextToolStates = nextProps.item.toolCallStates;

    return (
      prevMessage.content === nextMessage.content &&
      prevMessage.role === nextMessage.role &&
      JSON.stringify(prevToolStates) === JSON.stringify(nextToolStates) &&
      prevProps.item.conversationSummary ===
        nextProps.item.conversationSummary &&
      prevProps.index === nextProps.index
    );
  },
);

MemoizedMessage.displayName = "MemoizedMessage";
