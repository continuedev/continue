import { ContinueClient } from "@continuedev/sdk";
import { Box, Text, useApp } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import React, { useEffect, useState } from "react";
import { handleSlashCommands } from "../slashCommands.js";
import { StreamCallbacks, streamChatResponse } from "../streamChatResponse.js";
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
}

const TUIChat: React.FC<TUIChatProps> = ({
  assistant,
  client,
  initialPrompt,
}) => {
  const [chatHistory, setChatHistory] = useState<ChatCompletionMessageParam[]>(
    () => {
      const history: ChatCompletionMessageParam[] = [];
      const systemMessage = assistant.systemMessage;
      if (systemMessage) {
        history.push({ role: "system", content: systemMessage });
      }
      return history;
    }
  );

  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMode, setInputMode] = useState(true);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
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
          { role: "system", content: commandResult.output! },
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
    setChatHistory((prev) => [...prev, newUserMessage]);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    // Start streaming response
    const controller = new AbortController();
    setAbortController(controller);
    setIsWaitingForResponse(true);
    setInputMode(false);

    // Add placeholder for streaming message
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const newHistory = [...chatHistory, newUserMessage];
      let assistantResponse = "";

      // Create callbacks to handle streaming updates
      const streamCallbacks: StreamCallbacks = {
        onContent: (content: string) => {
          assistantResponse += content;
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.isStreaming) {
              lastMessage.content += content;
            }
            return newMessages;
          });
        },
        onToolStart: (toolName: string) => {
          setMessages((prev) => [
            ...prev,
            { role: "system", content: `[Using tool: ${toolName}]` },
          ]);
        },
        onToolResult: (result: string) => {
          setMessages((prev) => [...prev, { role: "system", content: result }]);
        },
        onToolError: (error: string) => {
          setMessages((prev) => [
            ...prev,
            { role: "system", content: `[Tool error: ${error}]` },
          ]);
        },
      };

      await streamChatResponse(newHistory, assistant, client, streamCallbacks, controller);

      // Finalize the assistant message
      const finalAssistantMessage: ChatCompletionMessageParam = {
        role: "assistant",
        content: assistantResponse,
      };
      setChatHistory((prev) => [...prev, finalAssistantMessage]);

      // Update messages to remove streaming flag
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.isStreaming) {
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });
    } catch (error: any) {
      const errorMessage = `Error: ${error.message}`;
      setMessages((prev) => [
        ...prev,
        { role: "system", content: errorMessage },
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
        { role: "system", content: "[Interrupted by user]" },
      ]);
    }
  };

  const renderMessage = (message: DisplayMessage, index: number) => {
    const isUser = message.role === "user";
    const isSystem = message.role === "system";

    if (isSystem) {
      return (
        <Box key={index} marginBottom={1}>
          <Text color="gray" italic>
            {message.content}
          </Text>
        </Box>
      );
    }

    return (
      <Box key={index} marginBottom={1}>
        <Text color={isUser ? "green" : "blue"} bold>
          ●
        </Text>
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
          <Box paddingX={1}>
            <Text color="gray">esc to interrupt</Text>
          </Box>
        )}

        {/* Input area - always at bottom */}
        <UserInput
          onSubmit={handleUserMessage}
          isWaitingForResponse={isWaitingForResponse}
          inputMode={inputMode}
          onInterrupt={handleInterrupt}
        />
      </Box>
    </Box>
  );
};

export default TUIChat;
