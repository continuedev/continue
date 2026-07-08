import { Box, Text } from "ink";
import React, { memo } from "react";

import { ToolCallTitle } from "src/tools/ToolCallTitle.js";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { MarkdownRenderer } from "../MarkdownRenderer.js";
import { ToolResultSummary } from "../ToolResultSummary.js";

/**
 * Formats message content for display, converting message parts array back to
 * user-friendly format with placeholders like [Image #1], [Pasted Text #1], etc.
 */
function formatMessageContentForDisplay(
  content: import("../../../../../core/index.js").MessageContent,
): string {
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
  item: ChatHistoryItem;
  index: number;
  hideBullet?: boolean;
}

export const MemoizedMessage = memo<MemoizedMessageProps>(
  ({ item, index, hideBullet = false }) => {
    const { message, toolCallStates, conversationSummary } = item;
    const isUser = message.role === "user";
    const isSystem = message.role === "system";
    const isAssistant = message.role === "assistant";

    // Handle system messages
    if (isSystem) {
      return (
        <Box key={index} marginBottom={1}>
          <Text color="dim" italic>
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
              <Text color="white">{hideBullet ? " " : "●"}</Text>
              <Text> </Text>
              <MarkdownRenderer
                content={formatMessageContentForDisplay(message.content)}
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
                <Box width="100%">
                  <Box flexShrink={0}>
                    <Text
                      color={
                        isErrored
                          ? "red"
                          : isCompleted
                            ? "green"
                            : toolState.status === "generated"
                              ? "yellow"
                              : "white"
                      }
                    >
                      {isCompleted || isErrored ? "●" : "○"}
                    </Text>
                  </Box>
                  <Box flexGrow={1} flexShrink={1} minWidth={0}>
                    <Text color="white">
                      {" "}
                      <ToolCallTitle toolName={toolName} args={toolArgs} />
                    </Text>
                  </Box>
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
        <Text color={isUser ? "blue" : "white"}>{hideBullet ? " " : "●"}</Text>
        <Text> </Text>
        {isUser ? (
          <Text color="dim">
            {formatMessageContentForDisplay(message.content)}
          </Text>
        ) : (
          <MarkdownRenderer
            content={formatMessageContentForDisplay(message.content)}
          />
        )}
        {isStreaming && <Text color="dim">▋</Text>}
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
      prevProps.index === nextProps.index &&
      prevProps.hideBullet === nextProps.hideBullet
    );
  },
);

MemoizedMessage.displayName = "MemoizedMessage";
