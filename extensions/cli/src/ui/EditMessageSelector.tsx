import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import type { ChatHistoryItem } from "../../../../core/index.js";

import { TextBuffer } from "./TextBuffer.js";
import { defaultBoxStyles } from "./styles.js";

interface EditMessageSelectorProps {
  chatHistory: ChatHistoryItem[];
  onEdit: (messageIndex: number, newContent: string) => void;
  onMessageSelected?: (originalIndex: number) => void;
  onExit: () => void;
}

export function EditMessageSelector({
  chatHistory,
  onEdit,
  onMessageSelected,
  onExit,
}: EditMessageSelectorProps) {
  // Filter to only show user messages
  const userMessages = useMemo(() => {
    return chatHistory
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => item.message.role === "user");
  }, [chatHistory]);

  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, userMessages.length - 1),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [textBuffer] = useState(() => new TextBuffer());
  const [editText, setEditText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);

  // Initialize edit text when selection changes
  React.useEffect(() => {
    if (!isEditing && userMessages[selectedIndex]) {
      const content =
        typeof userMessages[selectedIndex].item.message.content === "string"
          ? userMessages[selectedIndex].item.message.content
          : "";
      textBuffer.setText(content);
      setEditText(content);
      setCursorPosition(content.length);
    }
  }, [selectedIndex, isEditing, userMessages, textBuffer]);

  useInput((input, key) => {
    // If not editing, handle navigation
    if (!isEditing) {
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : userMessages.length - 1,
        );
      } else if (key.downArrow || input === "j") {
        setSelectedIndex((prev) =>
          prev < userMessages.length - 1 ? prev + 1 : 0,
        );
      } else if (key.return) {
        // Notify parent that a message was selected for editing
        if (onMessageSelected && userMessages[selectedIndex]) {
          const originalIndex = userMessages[selectedIndex].originalIndex;
          console.log("EditMessageSelector: User pressed Enter", {
            selectedIndex,
            originalIndex,
            totalUserMessages: userMessages.length,
            totalChatHistory: chatHistory.length,
          });
          onMessageSelected(originalIndex);
        }
        setIsEditing(true);
      } else if (key.escape || (key.ctrl && input === "d")) {
        onExit();
      }
    } else {
      // In edit mode, handle text input
      if (key.escape) {
        setIsEditing(false);
        // Reset text to original
        const content =
          typeof userMessages[selectedIndex].item.message.content === "string"
            ? userMessages[selectedIndex].item.message.content
            : "";
        textBuffer.setText(content);
        setEditText(content);
        setCursorPosition(content.length);
      } else if (key.return && !key.shift) {
        // Submit the edit
        const trimmedText = textBuffer.text.trim();
        if (trimmedText && userMessages[selectedIndex]) {
          onEdit(userMessages[selectedIndex].originalIndex, trimmedText);
        }
      } else if (key.return && key.shift) {
        // Handle newline
        textBuffer.handleInput("\n", key);
        setEditText(textBuffer.text);
        setCursorPosition(textBuffer.cursor);
      } else {
        // Let TextBuffer handle the input
        textBuffer.handleInput(input, key);
        setEditText(textBuffer.text);
        setCursorPosition(textBuffer.cursor);
      }
    }
  });

  if (userMessages.length === 0) {
    return (
      <Box {...defaultBoxStyles("yellow")}>
        <Text color="yellow">No user messages to edit.</Text>
        <Text color="gray">Press Esc to exit</Text>
      </Box>
    );
  }

  const renderEditText = () => {
    if (editText.length === 0) {
      return (
        <Text italic color="gray">
          ▋(empty message)
        </Text>
      );
    }

    // Handle multi-line text with cursor
    const lines = editText.split("\n");
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
    if (cursorPosition >= editText.length) {
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
  };

  const selectedMessage = userMessages[selectedIndex];
  const messageContent =
    typeof selectedMessage?.item.message.content === "string"
      ? selectedMessage.item.message.content
      : "";

  return (
    <Box {...defaultBoxStyles("yellow")}>
      <Text color="yellow" bold>
        Edit Message (Rewind Conversation)
      </Text>
      <Text color="gray">
        {isEditing
          ? "Enter to submit, Esc to cancel, Shift+Enter for newline"
          : "↑/↓ to navigate, Enter to edit, Esc to exit"}
      </Text>
      <Text> </Text>

      {!isEditing && (
        <>
          <Text color="blue">Select a message to edit:</Text>
          <Text> </Text>
          {userMessages.map((msg, index) => {
            const isSelected = index === selectedIndex;
            const indicator = isSelected ? "➤ " : "  ";
            const color = isSelected ? "yellow" : "white";
            const content =
              typeof msg.item.message.content === "string"
                ? msg.item.message.content
                : "";
            const preview = content.split("\n")[0].slice(0, 60);
            const truncated = content.length > 60 ? "..." : "";

            return (
              <Box key={msg.originalIndex} flexDirection="column">
                <Text bold={isSelected} color={color}>
                  {indicator}Message {index + 1}: {preview}
                  {truncated}
                </Text>
              </Box>
            );
          })}
        </>
      )}

      {isEditing && (
        <>
          <Text color="blue">
            Editing Message {selectedIndex + 1} (will rewind to this point):
          </Text>
          <Text> </Text>
          <Box
            borderStyle="round"
            borderColor="yellow"
            paddingX={1}
            flexDirection="column"
          >
            {renderEditText()}
          </Box>
        </>
      )}
    </Box>
  );
}
