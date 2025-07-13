import { ContinueClient } from "@continuedev/sdk";
import { Box, Text, useApp, useInput } from "ink";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
import React, { useEffect, useState } from "react";
import { handleSlashCommands } from "../slashCommands.js";
import { streamChatResponse } from "../streamChatResponse.js";
import { TextBuffer } from "./TextBuffer.js";

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

  const [textBuffer] = useState(() => new TextBuffer());
  const [inputText, setInputText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
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

    // Handle Enter key (regular enter for submit)
    if (key.return && !key.shift) {
      if (textBuffer.text.trim() && !isWaitingForResponse) {
        handleUserMessage(textBuffer.text.trim());
        textBuffer.clear();
        setInputText("");
        setCursorPosition(0);
      }
      return;
    }

    // Handle Shift+Enter (carriage return character) for new line
    if (input === "\r" || input === "\\\r") {
      const handled = textBuffer.handleInput("\n", key);
      if (handled) {
        setInputText(textBuffer.text);
        setCursorPosition(textBuffer.cursor);
      }
      return;
    }

    // Let TextBuffer handle the input
    const handled = textBuffer.handleInput(input, key);

    // Update React state to trigger re-render
    if (handled) {
      setInputText(textBuffer.text);
      setCursorPosition(textBuffer.cursor);
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
          ●
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

      {/* Input area with rounded corners */}
      <Box borderStyle="round" borderTop={true} paddingX={1}>
        <Text color="green" bold>
          ●{" "}
        </Text>
        {(() => {
          if (inputText.length === 0) {
            return (
              <>
                {inputMode && !isWaitingForResponse && (
                  <Text color="gray">▋Type your message...</Text>
                )}
                {(!inputMode || isWaitingForResponse) && (
                  <Text color="gray">Type your message...</Text>
                )}
              </>
            );
          }

          if (inputMode && !isWaitingForResponse) {
            // Handle multi-line text with cursor
            const lines = inputText.split("\n");
            let charCount = 0;
            let cursorLine = 0;
            let cursorCol = 0;

            // Find which line and column the cursor is on
            for (let i = 0; i < lines.length; i++) {
              if (cursorPosition <= charCount + lines[i].length) {
                cursorLine = i;
                cursorCol = cursorPosition - charCount;
                break;
              }
              charCount += lines[i].length + 1; // +1 for the newline character
            }

            // Handle cursor at the very end
            if (cursorPosition >= inputText.length) {
              cursorLine = lines.length - 1;
              cursorCol = lines[cursorLine].length;
            }

            return (
              <Box flexDirection="column">
                {lines.map((line, lineIndex) => {
                  if (lineIndex === cursorLine) {
                    // Line with cursor
                    const beforeCursor = line.slice(0, cursorCol);
                    const atCursor = line.slice(cursorCol, cursorCol + 1);
                    const afterCursor = line.slice(cursorCol + 1);

                    return (
                      <Text key={lineIndex}>
                        {beforeCursor}
                        <Text inverse>{atCursor || " "}</Text>
                        {afterCursor}
                      </Text>
                    );
                  } else {
                    // Regular line - ensure empty lines still render
                    return <Text key={lineIndex}>{line || " "}</Text>;
                  }
                })}
              </Box>
            );
          } else {
            // Not in input mode, just display the text
            return (
              <Box flexDirection="column">
                {inputText.split("\n").map((line, index) => (
                  <Text key={index}>{line || " "}</Text>
                ))}
              </Box>
            );
          }
        })()}
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