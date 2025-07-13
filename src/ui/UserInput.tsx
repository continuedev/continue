import { Box, Text, useApp, useInput } from "ink";
import React, { useState } from "react";
import { TextBuffer } from "./TextBuffer.js";

interface UserInputProps {
  onSubmit: (message: string) => void;
  isWaitingForResponse: boolean;
  inputMode: boolean;
}

const UserInput: React.FC<UserInputProps> = ({
  onSubmit,
  isWaitingForResponse,
  inputMode,
}) => {
  const [textBuffer] = useState(() => new TextBuffer());
  const [inputText, setInputText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const { exit } = useApp();

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
        onSubmit(textBuffer.text.trim());
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

  const renderInputText = () => {
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
  };

  return (
    <Box borderStyle="round" borderTop={true} paddingX={1}>
      <Text color="green" bold>
        ●{" "}
      </Text>
      {renderInputText()}
    </Box>
  );
};

export default UserInput;