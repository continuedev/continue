import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text, useApp, useInput } from "ink";
import React, { useState, useEffect } from "react";
import { hasMultipleOrganizations } from "../auth/workos.js";
import { InputHistory } from "../util/inputHistory.js";
import FileSearchUI from "./FileSearchUI.js";
import SlashCommandUI from "./SlashCommandUI.js";
import { TextBuffer } from "./TextBuffer.js";

interface UserInputProps {
  onSubmit: (message: string) => void;
  isWaitingForResponse: boolean;
  inputMode: boolean;
  onInterrupt?: () => void;
  assistant: AssistantConfig;
  onFileAttached?: (filePath: string, content: string) => void;
  disabled?: boolean;
}

const UserInput: React.FC<UserInputProps> = ({
  onSubmit,
  isWaitingForResponse,
  inputMode,
  onInterrupt,
  assistant,
  onFileAttached,
  disabled = false,
}) => {
  const [textBuffer] = useState(() => new TextBuffer());
  const [inputHistory] = useState(() => new InputHistory());
  const [inputText, setInputText] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [slashCommandFilter, setSlashCommandFilter] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchFilter, setFileSearchFilter] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentFiles, setCurrentFiles] = useState<
    Array<{ path: string; displayName: string }>
  >([]);
  const { exit } = useApp();

  // Get all available slash commands
  const [hasMultipleOrgs, setHasMultipleOrgs] = useState(false);

  useEffect(() => {
    hasMultipleOrganizations().then(setHasMultipleOrgs);
  }, []);

  const getSlashCommands = () => {
    const systemCommands = [
      { name: "help", description: "Show help message" },
      { name: "exit", description: "Exit the chat" },
      { name: "login", description: "Authenticate with your account" },
      { name: "logout", description: "Sign out of your current session" },
      {
        name: "whoami",
        description: "Check who you're currently logged in as",
      },
      ...(hasMultipleOrgs ? [{
        name: "org",
        description: "Switch organization",
      }] : []),
    ];

    const assistantCommands =
      assistant.prompts?.map((prompt) => ({
        name: prompt?.name || "",
        description: prompt?.description || "",
      })) || [];

    return [...systemCommands, ...assistantCommands];
  };

  // Update slash command UI state based on input
  const updateSlashCommandState = (text: string, cursor: number) => {
    // Check if we're in a slash command context
    const beforeCursor = text.slice(0, cursor);
    const lastSlashIndex = beforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      // Check if there's any whitespace between the last slash and cursor
      const afterSlash = beforeCursor.slice(lastSlashIndex + 1);

      if (!afterSlash.includes(" ") && !afterSlash.includes("\n")) {
        // We're in a slash command context
        setShowSlashCommands(true);
        setSlashCommandFilter(afterSlash);
        setSelectedCommandIndex(0);
        setShowFileSearch(false);
      } else {
        setShowSlashCommands(false);
      }
    } else {
      setShowSlashCommands(false);
    }
  };

  // Update file search UI state based on input
  const updateFileSearchState = (text: string, cursor: number) => {
    // Check if we're in a file search context
    const beforeCursor = text.slice(0, cursor);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // Check if there's any whitespace between the last @ and cursor
      const afterAt = beforeCursor.slice(lastAtIndex + 1);

      if (!afterAt.includes(" ") && !afterAt.includes("\n")) {
        // We're in a file search context
        setShowFileSearch(true);
        setFileSearchFilter(afterAt);
        setSelectedFileIndex(0);
        setShowSlashCommands(false);
      } else {
        setShowFileSearch(false);
      }
    } else {
      setShowFileSearch(false);
    }
  };

  // Get filtered commands for navigation - using the same sorting logic as SlashCommandUI
  const getFilteredCommands = () => {
    const allCommands = getSlashCommands();
    return allCommands
      .filter((cmd) =>
        cmd.name.toLowerCase().includes(slashCommandFilter.toLowerCase())
      )
      .sort((a, b) => {
        const aStartsWith = a.name
          .toLowerCase()
          .startsWith(slashCommandFilter.toLowerCase());
        const bStartsWith = b.name
          .toLowerCase()
          .startsWith(slashCommandFilter.toLowerCase());

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        return a.name.localeCompare(b.name);
      });
  };

  // Handle slash command selection
  const selectSlashCommand = (commandName: string) => {
    const beforeCursor = inputText.slice(0, cursorPosition);
    const lastSlashIndex = beforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      const beforeSlash = inputText.slice(0, lastSlashIndex);
      const afterCursor = inputText.slice(cursorPosition);

      // Replace the partial command with the full command
      const newText = beforeSlash + "/" + commandName + " " + afterCursor;
      const newCursorPos = lastSlashIndex + 1 + commandName.length + 1;

      textBuffer.setText(newText);
      textBuffer.setCursor(newCursorPos);
      setInputText(newText);
      setCursorPosition(newCursorPos);
      setShowSlashCommands(false);
    }
  };

  // Handle file selection
  const selectFile = async (filePath: string) => {
    const beforeCursor = inputText.slice(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const beforeAt = inputText.slice(0, lastAtIndex);
      const afterCursor = inputText.slice(cursorPosition);

      // Replace the partial file reference with the full file name
      const fileName = filePath.split("/").pop() || filePath;
      const newText = beforeAt + "@" + fileName + " " + afterCursor;
      const newCursorPos = lastAtIndex + 1 + fileName.length + 1;

      textBuffer.setText(newText);
      textBuffer.setCursor(newCursorPos);
      setInputText(newText);
      setCursorPosition(newCursorPos);
      setShowFileSearch(false);

      // Read the file content and notify parent component
      if (onFileAttached) {
        try {
          const fs = await import("fs/promises");
          const content = await fs.readFile(filePath, "utf-8");
          onFileAttached(filePath, content);
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
    }
  };

  useInput((input, key) => {
    // Don't handle any input when disabled
    if (disabled) {
      return;
    }
    if (key.ctrl && (input === "c" || input === "d")) {
      exit();
      return;
    }

    // Handle escape key to interrupt streaming
    if (key.escape && isWaitingForResponse && onInterrupt) {
      onInterrupt();
      return;
    }

    // Handle escape key to close slash command UI
    if (key.escape && showSlashCommands && inputMode) {
      setShowSlashCommands(false);
      return;
    }

    // Handle escape key to close file search UI
    if (key.escape && showFileSearch && inputMode) {
      setShowFileSearch(false);
      return;
    }

    // Allow typing during streaming, but block submission
    if (!inputMode) {
      // Block only Enter key submission during streaming
      if (key.return && !key.shift) {
        return;
      }
      // Allow all other input (typing, navigation, etc.)
    }

    // Handle slash command navigation
    if (showSlashCommands) {
      const filteredCommands = getFilteredCommands();

      if (key.upArrow) {
        setSelectedCommandIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }

      if (key.downArrow) {
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (key.return && !key.shift) {
        if (filteredCommands.length > 0) {
          selectSlashCommand(filteredCommands[selectedCommandIndex].name);
        }
        return;
      }

      if (key.tab) {
        if (filteredCommands.length > 0) {
          selectSlashCommand(filteredCommands[selectedCommandIndex].name);
        }
        return;
      }
    }

    // Handle file search navigation
    if (showFileSearch) {
      if (key.upArrow) {
        setSelectedFileIndex((prev) =>
          prev > 0
            ? prev - 1
            : Math.max(0, Math.min(currentFiles.length - 1, 9))
        );
        return;
      }

      if (key.downArrow) {
        setSelectedFileIndex((prev) =>
          prev < Math.min(currentFiles.length - 1, 9) ? prev + 1 : 0
        );
        return;
      }

      if (key.return && !key.shift) {
        if (
          currentFiles.length > 0 &&
          selectedFileIndex < currentFiles.length
        ) {
          selectFile(currentFiles[selectedFileIndex].path);
        }
        return;
      }

      if (key.tab) {
        if (
          currentFiles.length > 0 &&
          selectedFileIndex < currentFiles.length
        ) {
          selectFile(currentFiles[selectedFileIndex].path);
        }
        return;
      }
    }

    // Handle input history navigation (only when not in slash command or file search mode)
    if (!showSlashCommands && !showFileSearch) {
      if (key.upArrow) {
        const historyEntry = inputHistory.navigateUp(inputText);
        if (historyEntry !== null) {
          textBuffer.setText(historyEntry);
          textBuffer.setCursor(historyEntry.length);
          setInputText(historyEntry);
          setCursorPosition(historyEntry.length);
        }
        return;
      }

      if (key.downArrow) {
        const historyEntry = inputHistory.navigateDown(inputText);
        if (historyEntry !== null) {
          textBuffer.setText(historyEntry);
          textBuffer.setCursor(historyEntry.length);
          setInputText(historyEntry);
          setCursorPosition(historyEntry.length);
        }
        return;
      }
    }

    // Handle Enter key (regular enter for submit)
    if (key.return && !key.shift) {
      if (textBuffer.text.trim() && !isWaitingForResponse) {
        const submittedText = textBuffer.text.trim();
        inputHistory.addEntry(submittedText);
        onSubmit(submittedText);
        textBuffer.clear();
        setInputText("");
        setCursorPosition(0);
        setShowSlashCommands(false);
      }
      // Note: Enter key is already blocked during streaming by the inputMode check above
      return;
    }

    // Handle Shift+Enter (carriage return character) for new line
    if (input === "\r" || input === "\\\r") {
      const handled = textBuffer.handleInput("\n", key);
      if (handled) {
        const newText = textBuffer.text;
        const newCursor = textBuffer.cursor;
        setInputText(newText);
        setCursorPosition(newCursor);
        updateSlashCommandState(newText, newCursor);
        updateFileSearchState(newText, newCursor);
      }
      return;
    }

    // Let TextBuffer handle the input
    const handled = textBuffer.handleInput(input, key);

    // Update React state to trigger re-render
    if (handled) {
      const newText = textBuffer.text;
      const newCursor = textBuffer.cursor;
      setInputText(newText);
      setCursorPosition(newCursor);
      updateSlashCommandState(newText, newCursor);
      updateFileSearchState(newText, newCursor);

      // Reset history navigation when user starts typing
      inputHistory.resetNavigation();
    }
  });

  const renderInputText = () => {
    const placeholderText = "Ask anything, @ for context, / for slash commands";
    if (inputText.length === 0) {
      return (
        <>
          {(inputMode || isWaitingForResponse) && (
            <Text color="gray">▋{placeholderText}</Text>
          )}
          {!inputMode && !isWaitingForResponse && (
            <Text color="gray">{placeholderText}</Text>
          )}
        </>
      );
    }

    if (inputMode || isWaitingForResponse) {
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

  // Don't render anything when disabled
  if (disabled) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Input box */}
      <Box borderStyle="round" borderTop={true} paddingX={1} borderColor="gray">
        <Text color="green" bold>
          ●{" "}
        </Text>
        {renderInputText()}
      </Box>

      {/* Slash command UI */}
      {showSlashCommands && inputMode && (
        <SlashCommandUI
          assistant={assistant}
          filter={slashCommandFilter}
          selectedIndex={selectedCommandIndex}
          onSelect={selectSlashCommand}
        />
      )}

      {/* File search UI */}
      {showFileSearch && inputMode && (
        <FileSearchUI
          filter={fileSearchFilter}
          selectedIndex={selectedFileIndex}
          onSelect={selectFile}
          onFilesUpdated={setCurrentFiles}
        />
      )}
    </Box>
  );
};

export default UserInput;
