/* eslint-disable max-lines */
import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useState } from "react";

import { getAllSlashCommands } from "../commands/commands.js";
import { useServices } from "../hooks/useService.js";
import type { PermissionMode } from "../permissions/types.js";
import type { FileIndexServiceState } from "../services/FileIndexService.js";
import { SERVICE_NAMES, serviceContainer } from "../services/index.js";
import { modeService } from "../services/ModeService.js";
import { InputHistory } from "../util/inputHistory.js";

import { FileSearchUI } from "./FileSearchUI.js";
import {
  handleControlKeys,
  updateTextBufferState,
} from "./hooks/useUserInput.js";
import { SlashCommandUI } from "./SlashCommandUI.js";
import { TextBuffer } from "./TextBuffer.js";

interface UserInputProps {
  onSubmit: (message: string) => void;
  isWaitingForResponse: boolean;
  inputMode: boolean;
  onInterrupt?: () => void;
  assistant?: AssistantConfig;
  onFileAttached?: (filePath: string, content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hideNormalUI?: boolean;
  isRemoteMode?: boolean;
}

const UserInput: React.FC<UserInputProps> = ({
  onSubmit,
  isWaitingForResponse,
  inputMode,
  onInterrupt,
  assistant,
  onFileAttached,
  disabled = false,
  placeholder,
  hideNormalUI = false,
  isRemoteMode = false,
}) => {
  const [textBuffer] = useState(() => new TextBuffer());
  const [inputHistory] = useState(() => new InputHistory());

  // Stable callback for TextBuffer state changes to prevent race conditions
  const onStateChange = useCallback(() => {
    setInputText(textBuffer.text);
    setCursorPosition(textBuffer.cursor);
  }, [textBuffer]);

  // Set up callback for when TextBuffer state changes (e.g., rapid input finalized)
  React.useEffect(() => {
    textBuffer.setStateChangeCallback(onStateChange);

    // Cleanup on unmount: clear any pending timers
    return () => {
      textBuffer.clear();
    };
  }, [textBuffer, onStateChange]);
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

  // Get file index service
  const { services } = useServices<{
    fileIndex: FileIndexServiceState;
  }>(["fileIndex"]);

  const getSlashCommands = () => {
    if (assistant || isRemoteMode) {
      return getAllSlashCommands(assistant || ({} as AssistantConfig), {
        isRemoteMode,
      });
    }

    // Fallback - basic commands without assistant
    return [
      { name: "help", description: "Show help message" },
      { name: "clear", description: "Clear the chat history" },
      { name: "exit", description: "Exit the chat" },
    ];
  };

  // Cycle through permission modes
  const cycleModes = async () => {
    const modes: PermissionMode[] = ["normal", "plan", "auto"];
    const currentMode = modeService.getCurrentMode();
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];

    modeService.switchMode(nextMode);

    // Update the service container with the new tool permissions state
    // Since TOOL_PERMISSIONS was registered with registerValue(), we need to
    // update its value directly rather than reloading from a factory
    const updatedState = modeService.getToolPermissionService().getState();
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, updatedState);

    // Show a brief indicator of the mode change
    // This will be reflected in the ModeIndicator component
    return nextMode;
  };

  // Update slash command UI state based on input
  const updateSlashCommandState = (text: string, cursor: number) => {
    // Only show slash commands if slash is the very first character
    if (!text.trimStart().startsWith("/")) {
      setShowSlashCommands(false);
      return;
    }

    const trimmedText = text.trimStart();
    const beforeCursor = trimmedText.slice(
      0,
      cursor - (text.length - trimmedText.length),
    );

    // Only show if cursor is after the slash and before any whitespace
    if (beforeCursor.length === 0 || !beforeCursor.startsWith("/")) {
      setShowSlashCommands(false);
      return;
    }

    const afterSlash = beforeCursor.slice(1);

    // Check if we have whitespace in the command
    if (afterSlash.includes(" ") || afterSlash.includes("\n")) {
      setShowSlashCommands(false);
      return;
    }

    // We're in a slash command context - check if it's a complete command
    const allCommands = getSlashCommands();
    const exactMatch = allCommands.find((cmd) => cmd.name === afterSlash);

    // Hide selector if we have an exact match and there's a space after cursor
    if (exactMatch) {
      const restOfText = text.slice(cursor);
      // Only hide if there's a space or newline immediately after cursor
      const shouldHide =
        restOfText.startsWith(" ") || restOfText.startsWith("\n");
      if (shouldHide) {
        setShowSlashCommands(false);
        return;
      }
    }

    // Check if there are any matching commands
    const filteredCommands = allCommands.filter((cmd) =>
      cmd.name.toLowerCase().includes(afterSlash.toLowerCase()),
    );

    // If no commands match, hide the dropdown to allow normal Enter behavior
    if (filteredCommands.length === 0) {
      setShowSlashCommands(false);
      return;
    }

    // Show selector for partial matches
    setShowSlashCommands(true);
    setSlashCommandFilter(afterSlash);
    setSelectedCommandIndex(0);
    setShowFileSearch(false);
  };

  // Update file search UI state based on input
  const updateFileSearchState = (text: string, cursor: number) => {
    // Don't show file search in remote mode
    if (isRemoteMode) {
      setShowFileSearch(false);
      return;
    }

    // Check if we're in a file search context
    const beforeCursor = text.slice(0, cursor);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      setShowFileSearch(false);
    } else {
      // Check if there's any whitespace between the last @ and cursor
      const afterAt = beforeCursor.slice(lastAtIndex + 1);

      if (afterAt.includes(" ") || afterAt.includes("\n")) {
        setShowFileSearch(false);
      } else {
        // We're in a file search context - check if there are matching files
        const fileIndexService = services.fileIndex;
        if (fileIndexService) {
          const filteredFiles = fileIndexService.files.filter((file) => {
            if (afterAt.length === 0) {
              return true;
            }
            const lowerFilter = afterAt.toLowerCase();
            return (
              file.displayName.toLowerCase().includes(lowerFilter) ||
              file.path.toLowerCase().includes(lowerFilter)
            );
          });

          // If no files match, hide the dropdown to allow normal Enter behavior
          if (filteredFiles.length === 0 && afterAt.length > 0) {
            setShowFileSearch(false);
            return;
          }
        }

        setShowFileSearch(true);
        setFileSearchFilter(afterAt);
        setSelectedFileIndex(0);
        setShowSlashCommands(false);
      }
    }
  };

  // Get filtered commands for navigation - using the same sorting logic as SlashCommandUI
  const getFilteredCommands = () => {
    const allCommands = getSlashCommands();
    return allCommands
      .filter((cmd) =>
        cmd.name.toLowerCase().includes(slashCommandFilter.toLowerCase()),
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

      // Replace the partial file reference with the full file path
      const newText = beforeAt + "@" + filePath + " " + afterCursor;
      const newCursorPos = lastAtIndex + 1 + filePath.length + 1;

      textBuffer.setText(newText);
      textBuffer.setCursor(newCursorPos);
      setInputText(newText);
      setCursorPosition(newCursorPos);
      setShowFileSearch(false);

      // Read the file content and notify parent component
      if (onFileAttached) {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const absolutePath = path.resolve(filePath);
          const content = await fs.readFile(absolutePath, "utf-8");
          onFileAttached(absolutePath, content);
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
        }
      }
    }
  };

  const handleSlashCommandNavigation = (key: any): boolean => {
    const filteredCommands = getFilteredCommands();

    if (key.upArrow) {
      setSelectedCommandIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1,
      );
      return true;
    }

    if (key.downArrow) {
      setSelectedCommandIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0,
      );
      return true;
    }

    if ((key.return && !key.shift) || key.tab) {
      if (filteredCommands.length > 0) {
        selectSlashCommand(filteredCommands[selectedCommandIndex].name);
      }
      return true;
    }

    return false;
  };

  const handleFileSearchNavigation = (key: any): boolean => {
    if (key.upArrow) {
      setSelectedFileIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, Math.min(currentFiles.length - 1, 9)),
      );
      return true;
    }

    if (key.downArrow) {
      setSelectedFileIndex((prev) =>
        prev < Math.min(currentFiles.length - 1, 9) ? prev + 1 : 0,
      );
      return true;
    }

    if ((key.return && !key.shift) || key.tab) {
      if (currentFiles.length > 0 && selectedFileIndex < currentFiles.length) {
        selectFile(currentFiles[selectedFileIndex].path);
      }
      return true;
    }

    return false;
  };

  const handleHistoryNavigation = (key: any): boolean => {
    if (!showSlashCommands && !showFileSearch) {
      if (key.upArrow) {
        const historyEntry = inputHistory.navigateUp(inputText);
        if (historyEntry !== null) {
          textBuffer.setText(historyEntry);
          textBuffer.setCursor(historyEntry.length);
          setInputText(historyEntry);
          setCursorPosition(historyEntry.length);
        }
        return true;
      }

      if (key.downArrow) {
        const historyEntry = inputHistory.navigateDown();
        if (historyEntry !== null) {
          textBuffer.setText(historyEntry);
          textBuffer.setCursor(historyEntry.length);
          setInputText(historyEntry);
          setCursorPosition(historyEntry.length);
        }
        return true;
      }
    }
    return false;
  };

  const handleEnterKey = (key: any): boolean => {
    if (key.return && !key.shift) {
      // Check for backslash continuation
      const beforeCursor = textBuffer.text.slice(0, cursorPosition);
      const trimmedBeforeCursor = beforeCursor.trimEnd();

      if (trimmedBeforeCursor.endsWith("\\")) {
        // Handle backslash continuation: remove the trailing "\" and add newline
        const beforeBackslash = trimmedBeforeCursor.slice(0, -1);
        const afterCursor = textBuffer.text.slice(cursorPosition);
        const newText = beforeBackslash + "\n" + afterCursor;
        const newCursorPos = beforeBackslash.length + 1;

        textBuffer.setText(newText);
        textBuffer.setCursor(newCursorPos);
        setInputText(newText);
        setCursorPosition(newCursorPos);
        updateSlashCommandState(newText, newCursorPos);
        updateFileSearchState(newText, newCursorPos);
        return true;
      }

      // Normal Enter behavior - submit if there's content
      if (textBuffer.text.trim() && !isWaitingForResponse) {
        // Expand all paste blocks before submitting
        textBuffer.expandAllPasteBlocks();
        const submittedText = textBuffer.text.trim();
        inputHistory.addEntry(submittedText);
        onSubmit(submittedText);
        textBuffer.clear();
        setInputText("");
        setCursorPosition(0);
        setShowSlashCommands(false);
      }
      return true;
    }
    return false;
  };

  const handleNewLine = (input: string, key: any): boolean => {
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
      return true;
    }
    return false;
  };

  const handleEscapeKey = (key: any): boolean => {
    if (!key.escape) return false;

    // Handle escape key to interrupt streaming
    if (isWaitingForResponse && onInterrupt) {
      onInterrupt();
      return true;
    }

    // Handle escape key to close slash command UI
    if (showSlashCommands && inputMode) {
      setShowSlashCommands(false);
      return true;
    }

    // Handle escape key to close file search UI
    if (showFileSearch && inputMode) {
      setShowFileSearch(false);
      return true;
    }

    return false;
  };

  // Clear input function
  const clearInput = () => {
    textBuffer.clear();
    setInputText("");
    setCursorPosition(0);
    setShowSlashCommands(false);
    setShowFileSearch(false);
    inputHistory.resetNavigation();
  };

  useInput((input, key) => {
    // Don't handle any input when disabled
    if (disabled) {
      return;
    }

    // Handle control keys
    if (
      handleControlKeys({
        input,
        key,
        exit,
        showSlashCommands,
        showFileSearch,
        cycleModes,
        clearInput,
      })
    ) {
      return;
    }

    // Handle escape key variations
    if (handleEscapeKey(key)) {
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
      if (handleSlashCommandNavigation(key)) {
        return;
      }
    }

    // Handle file search navigation
    if (showFileSearch) {
      if (handleFileSearchNavigation(key)) {
        return;
      }
    }

    // Handle input history navigation
    if (handleHistoryNavigation(key)) {
      return;
    }

    // Handle Enter key
    if (handleEnterKey(key)) {
      return;
    }

    // Handle Shift+Enter (new line)
    if (handleNewLine(input, key)) {
      return;
    }

    // Let TextBuffer handle the input
    const handled = textBuffer.handleInput(input, key);

    // Update React state to trigger re-render
    updateTextBufferState({
      handled,
      textBuffer,
      setInputText,
      setCursorPosition,
      updateSlashCommandState,
      updateFileSearchState,
      inputHistory,
    });
  });

  const renderInputText = () => {
    const placeholderText = isRemoteMode
      ? "Ask anything, / for slash commands"
      : placeholder || "Ask anything, @ for context, / for slash commands";
    if (inputText.length === 0) {
      return (
        <>
          {(inputMode || isWaitingForResponse) && (
            <Text italic color="gray">
              ▋{placeholderText}
            </Text>
          )}
          {!inputMode && !isWaitingForResponse && (
            <Text italic color="gray">
              {placeholderText}
            </Text>
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
      <Box
        borderStyle="round"
        borderTop={true}
        paddingX={1}
        borderColor={isRemoteMode ? "cyan" : "gray"}
      >
        <Text color={isRemoteMode ? "cyan" : "blue"} bold>
          {isRemoteMode ? "◉" : "●"}{" "}
        </Text>
        {renderInputText()}
      </Box>

      {/* Slash command UI - show in remote mode OR when assistant is available */}
      {showSlashCommands &&
        inputMode &&
        !hideNormalUI &&
        (isRemoteMode || assistant) && (
          <SlashCommandUI
            assistant={assistant}
            filter={slashCommandFilter}
            selectedIndex={selectedCommandIndex}
            isRemoteMode={isRemoteMode}
          />
        )}

      {/* File search UI - only show in local mode */}
      {showFileSearch && inputMode && !hideNormalUI && !isRemoteMode && (
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

export { UserInput };
