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
  const [attachedFiles, setAttachedFiles] = useState<Array<{path: string; content: string}>>([]);
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

      if (commandResult.clear) {
        // Clear chat history but keep system message
        const systemMessage = chatHistory.find(msg => msg.role === "system");
        const newHistory = systemMessage ? [systemMessage] : [];
        setChatHistory(newHistory);
        setMessages([]);
        
        // Add command output to messages
        if (commandResult.output) {
          setMessages([{
            role: "system",
            content: commandResult.output!,
            messageType: "system",
          }]);
        }
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
    let messageContent = message;
    
    // Prepend attached files to the message
    if (attachedFiles.length > 0) {
      const fileContents = attachedFiles.map(file => 
        `\n\n<file path="${file.path}">\n${file.content}\n</file>`
      ).join('');
      messageContent = `${message}${fileContents}`;
      
      // Clear attached files after sending
      setAttachedFiles([]);
    }
    
    const newUserMessage: ChatCompletionMessageParam = {
      role: "user",
      content: messageContent,
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
          // Buffer content but don't update UI until complete or tool call
          if (!currentStreamingMessage) {
            currentStreamingMessage = { role: "assistant", content: "", isStreaming: true };
          }
          currentStreamingMessage.content += content;
        },
        onContentComplete: (content: string) => {
          // Display the complete message
          if (currentStreamingMessage) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: content, isStreaming: false }
            ]);
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

          // Display buffered content when tool starts
          if (currentStreamingMessage && currentStreamingMessage.content) {
            const messageContent = currentStreamingMessage.content;
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: messageContent, isStreaming: false }
            ]);
            currentStreamingMessage = null;
          }

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
      if (currentStreamingMessage && (currentStreamingMessage as any).content) {
        const messageContent = (currentStreamingMessage as any).content;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: messageContent, isStreaming: false }
        ]);
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

  const handleFileAttached = (filePath: string, content: string) => {
    setAttachedFiles(prev => [...prev, { path: filePath, content }]);
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
          onFileAttached={handleFileAttached}
        />
        <Box marginRight={2} justifyContent="flex-end">
          <Text color="gray">● Continue CLI</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default TUIChat;
