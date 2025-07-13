import { ContinueClient } from "@continuedev/sdk";
import { Box, Text, useApp, useInput } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import React, { useEffect, useState } from "react";
import { handleSlashCommands } from "../slashCommands.js";
import { streamChatResponse } from "../streamChatResponse.js";

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

  const [userInput, setUserInput] = useState("");
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputMode, setInputMode] = useState(true);
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

      // Mock the streaming for now - you'll need to modify streamChatResponse
      // to accept a callback or use a different approach
      await streamChatResponse(newHistory, assistant, client);

      // For now, we'll just wait and then get the response
      // In a real implementation, you'd need to modify streamChatResponse
      // to provide a way to capture the streamed content

      // Finalize the assistant message
      const finalAssistantMessage: ChatCompletionMessageParam = {
        role: "assistant",
        content: assistantResponse || "Response received", // Fallback
      };
      setChatHistory((prev) => [...prev, finalAssistantMessage]);

      // Update messages to remove streaming flag
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.isStreaming) {
          lastMessage.isStreaming = false;
          if (!lastMessage.content) {
            lastMessage.content = "Response received";
          }
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
      setIsWaitingForResponse(false);
      setInputMode(true);
    }
  };

  useInput((input, key) => {
    if (key.ctrl && (input === "c" || input === "d")) {
      exit();
      return;
    }

    if (!inputMode) {
      return;
    }

    if (key.return) {
      if (userInput.trim() && !isWaitingForResponse) {
        handleUserMessage(userInput.trim());
        setUserInput("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setUserInput((prev) => prev.slice(0, -1));
      return;
    }

    // Only add printable characters
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setUserInput((prev) => prev + input);
    }
  });

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
          {isUser ? "You:" : "Assistant:"}
        </Text>
        <Text> {message.content}</Text>
        {message.isStreaming && <Text color="gray">▋</Text>}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.map(renderMessage)}
      </Box>

      {/* Input area */}
      <Box borderStyle="single" borderTop={true} paddingX={1}>
        <Text color="green" bold>
          You:{" "}
        </Text>
        <Text>{userInput}</Text>
        {inputMode && !isWaitingForResponse && <Text color="gray">▋</Text>}
      </Box>

      {/* Status */}
      {isWaitingForResponse && (
        <Box paddingX={1}>
          <Text color="yellow">Waiting for response...</Text>
        </Box>
      )}
    </Box>
  );
};

export default TUIChat;
