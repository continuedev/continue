import { ContinueClient } from "@continuedev/sdk";
import { Box, Text, useApp } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import path from "path";
import React, { useEffect, useState } from "react";
import { handleSlashCommands } from "../slashCommands.js";
import { StreamCallbacks, streamChatResponse } from "../streamChatResponse.js";
import { constructSystemMessage } from "../systemMessage.js";
import { getToolDisplayName } from "../tools.js";
import LoadingAnimation from "./LoadingAnimation.js";
import ToolResultSummary from "./ToolResultSummary.js";
import UserInput from "./UserInput.js";

interface TUIChatProps {
  assistant: ContinueClient["assistant"];
  client: ContinueClient["client"];
  initialPrompt?: string;
}

interface DisplayMessage {
  role: string;
  content: string;
  isStreaming?: boolean;
  messageType?: "tool-start" | "tool-result" | "tool-error" | "system";
  toolName?: string;
  toolResult?: string;
}

const TUIChat: React.FC<TUIChatProps> = ({
  assistant,
  client,
  initialPrompt,
}) => {
  const [chatHistory, setChatHistory] = useState<ChatCompletionMessageParam[]>(
    () => {
      const history: ChatCompletionMessageParam[] = [];
      const rulesSystemMessage = assistant.systemMessage;
      const systemMessage = constructSystemMessage(rulesSystemMessage);
      if (systemMessage) {
        history.push({ role: "system", content: systemMessage });
      }
      return history;
    }
  );

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const { exit } = useApp();

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt) {
      handleUserMessage(initialPrompt);
    }
  }, [initialPrompt]);

  const handleUserMessage = async (message: string) => {
    // Handle slash commands
    const commandResult = handleSlashCommands(message, assistant.config);
    if (commandResult) {
      if (commandResult.exit) {
        exit();
        return;
      }

      // Add command output to messages
      if (commandResult.output) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: commandResult.output!,
            messageType: "system",
          },
        ]);
      }

      if (commandResult.newInput) {
        message = commandResult.newInput;
      } else {
        return;
      }
    }

    // Add user message to history and display
    const newUserMessage: ChatCompletionMessageParam = {
      role: "user",
      content: message,
    };
    const newHistory = [...chatHistory, newUserMessage];
    setChatHistory(newHistory);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    // Start streaming response
    const controller = new AbortController();
    setAbortController(controller);
    setIsWaitingForResponse(true);
    setInputMode(false);

    try {
      let currentStreamingMessage: DisplayMessage | null = null;

      // Create callbacks to handle streaming updates
      const streamCallbacks: StreamCallbacks = {
        onContent: (content: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            
            // Find or create current streaming message
            if (!currentStreamingMessage) {
              currentStreamingMessage = { role: "assistant", content: "", isStreaming: true };
              newMessages.push(currentStreamingMessage);
            }
            
            // Update the streaming message
            const streamingIndex = newMessages.indexOf(currentStreamingMessage);
            if (streamingIndex >= 0) {
              newMessages[streamingIndex].content += content;
            }
            
            return newMessages;
          });
        },
        onContentComplete: (content: string) => {
          // Finalize the current streaming message
          if (currentStreamingMessage) {
            setMessages((prev) => {
              const newMessages = [...prev];
              const streamingIndex = newMessages.indexOf(currentStreamingMessage!);
              if (streamingIndex >= 0) {
                newMessages[streamingIndex].isStreaming = false;
                newMessages[streamingIndex].content = content;
              }
              return newMessages;
            });
            currentStreamingMessage = null;
          }
        },
        onToolStart: (toolName: string, toolArgs?: any) => {
          const formatToolCall = (name: string, args: any) => {
            const displayName = getToolDisplayName(name);
            if (!args) return displayName;

            // Get the first parameter value for display
            const firstValue = Object.values(args)[0];
            
            // Convert absolute paths to relative paths from workspace root
            const formatPath = (value: any) => {
              if (typeof value === "string" && path.isAbsolute(value)) {
                const workspaceRoot = process.cwd();
                const relativePath = path.relative(workspaceRoot, value);
                return relativePath || value;
              }
              return value;
            };

            return `${displayName}(${formatPath(firstValue) || ""})`;
          };

          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: formatToolCall(toolName, toolArgs),
              messageType: "tool-start",
              toolName,
            },
          ]);
        },
        onToolResult: (result: string, toolName: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            // Find the last tool-start message for this tool and replace it
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (
                newMessages[i].messageType === "tool-start" &&
                newMessages[i].toolName === toolName
              ) {
                newMessages[i] = {
                  ...newMessages[i],
                  messageType: "tool-result",
                  toolResult: result, // Store the actual result separately
                };
                break;
              }
            }
            return newMessages;
          });
        },
        onToolError: (error: string, toolName?: string) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: error,
              messageType: "tool-error",
              toolName,
            },
          ]);
        },
      };

      await streamChatResponse(
        newHistory,
        assistant,
        client,
        streamCallbacks,
        controller
      );

      // Finalize any remaining streaming message
      if (currentStreamingMessage) {
        setMessages((prev) => {
          const newMessages = [...prev];
          const streamingIndex = newMessages.indexOf(currentStreamingMessage!);
          if (streamingIndex >= 0) {
            newMessages[streamingIndex].isStreaming = false;
          }
          return newMessages;
        });
      }
    } catch (error: any) {
      const errorMessage = `Error: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { role: "system", content: errorMessage, messageType: "system" },
      ]);
    } finally {
      setAbortController(null);
      setIsWaitingForResponse(false);
      setInputMode(true);
    }
  };

  const handleInterrupt = () => {
    if (abortController && isWaitingForResponse) {
      abortController.abort();
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "[Interrupted by user]",
          messageType: "system",
        },
      ]);
    }
  };

  const renderMessage = (message: DisplayMessage, index: number) => {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
      // Handle different types of system messages
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
          // Regular system messages
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
        <Text> {message.content}</Text>
        {message.isStreaming && <Text color="gray">▋</Text>}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up all available space above input */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {messages.map(renderMessage)}
      </Box>

      {/* Fixed bottom section */}
      <Box flexDirection="column" flexShrink={0}>
        {/* Status */}
        {isWaitingForResponse && (
          <Box paddingX={1} flexDirection="row" gap={1}>
            <LoadingAnimation visible={isWaitingForResponse} />
            <Text color="gray">esc to interrupt</Text>
          </Box>
        )}

        {/* Input area - always at bottom */}
        <UserInput
          onSubmit={handleUserMessage}
          isWaitingForResponse={isWaitingForResponse}
          inputMode={inputMode}
          onInterrupt={handleInterrupt}
          assistant={assistant.config}
        />
        <Box marginRight={2} justifyContent="flex-end">
          <Text color="gray">● Continue CLI</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default TUIChat;
