/* eslint-disable max-lines */

import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useRef, useState } from "react";

import { getAllSlashCommands } from "../commands/commands.js";
import { useServices } from "../hooks/useService.js";
import type { PermissionMode } from "../permissions/types.js";
import type { FileIndexServiceState } from "../services/FileIndexService.js";
import {
  SERVICE_NAMES,
  serviceContainer,
  services,
} from "../services/index.js";
import { messageQueue } from "../stream/messageQueue.js";
import { escapeEvents } from "../util/cli.js";
import { InputHistory } from "../util/inputHistory.js";

import { FileSearchUI } from "./FileSearchUI.js";
import { useClipboardMonitor } from "./hooks/useClipboardMonitor.js";
import {
  handleControlKeys,
  updateTextBufferState,
} from "./hooks/useUserInput.js";
import { SlashCommandUI } from "./SlashCommandUI.js";
import { TextBuffer } from "./TextBuffer.js";

// Small presentational helpers to reduce cyclomatic complexity in UserInput
const InterruptedBanner: React.FC<{ wasInterrupted: boolean }> = ({
  wasInterrupted,
}) => {
  if (!wasInterrupted) return null;
  return (
    <Box paddingX={1} marginBottom={0}>
      <Text color="yellow">Interrupted by user - Press enter to continue</Text>
    </Box>
  );
};

const SlashCommandsMaybe: React.FC<{
  show: boolean;
  inputMode: boolean;
  hideNormalUI: boolean;
  isRemoteMode: boolean;
  assistant?: AssistantConfig;
  filter: string;
  selectedIndex: number;
}> = ({
  show,
  inputMode,
  hideNormalUI,
  isRemoteMode,
  assistant,
  filter,
  selectedIndex,
}) => {
  if (!show || !inputMode || hideNormalUI || !(isRemoteMode || assistant))
    return null;
  return (
    <SlashCommandUI
      assistant={assistant}
      filter={filter}
      selectedIndex={selectedIndex}
      isRemoteMode={isRemoteMode}
    />
  );
};

const FileSearchMaybe: React.FC<{
  show: boolean;
  inputMode: boolean;
  hideNormalUI: boolean;
  isRemoteMode: boolean;
  filter: string;
  selectedIndex: number;
  onSelect: (path: string) => void | Promise<void>;
  onFilesUpdated: (files: Array<{ path: string; displayName: string }>) => void;
}> = ({
  show,
  inputMode,
  hideNormalUI,
  isRemoteMode,
  filter,
  selectedIndex,
  onSelect,
  onFilesUpdated,
}) => {
  if (!show || !inputMode || hideNormalUI || isRemoteMode) return null;
  return (
    <FileSearchUI
      filter={filter}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onFilesUpdated={onFilesUpdated}
    />
  );
};

interface UserInputProps {
  onSubmit: (message: string, imageMap?: Map<string, Buffer>) => void;
  isWaitingForResponse: boolean;
  isCompacting?: boolean;
  inputMode: boolean;
  onInterrupt?: () => void;
  assistant?: AssistantConfig;
  wasInterrupted?: boolean;
  onFileAttached?: (filePath: string, content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hideNormalUI?: boolean;
  isRemoteMode?: boolean;
  onImageInClipboardChange?: (hasImage: boolean) => void;
  onShowEditSelector?: () => void;
}

const UserInput: React.FC<UserInputProps> = ({
  onSubmit,
  isWaitingForResponse,
  isCompacting = false,
  inputMode,
  onInterrupt,
  assistant,
  wasInterrupted = false,
  onFileAttached,
  disabled = false,
  placeholder,
  hideNormalUI = false,
  isRemoteMode = false,
  onImageInClipboardChange,
  onShowEditSelector,
}) => {
  const [textBuffer] = useState(() => new TextBuffer());
  const [inputHistory] = useState(() => new InputHistory());
  const lastEscapePressRef = useRef<number>(0);

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

  // Clear input function for Ctrl+C
  const clearInput = useCallback(() => {
    textBuffer.clear();
    setInputText("");
    setCursorPosition(0);
    setShowSlashCommands(false);
    setShowFileSearch(false);
    setShowBashMode(false);
    inputHistory.resetNavigation();
  }, [textBuffer]);

  const [slashCommandFilter, setSlashCommandFilter] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showBashMode, setShowBashMode] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchFilter, setFileSearchFilter] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentFiles, setCurrentFiles] = useState<
    Array<{ path: string; displayName: string }>
  >([]);
  const { exit } = useApp();

  // Get file index service state for reactive updates (unused but needed for service initialization)
  useServices<{
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
    const currentMode = services.toolPermissions.getCurrentMode();
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];

    services.toolPermissions.switchMode(nextMode);

    // Update the service container with the new tool permissions state
    // Since TOOL_PERMISSIONS was registered with registerValue(), we need to
    // update its value directly rather than reloading from a factory
    const updatedState = services.toolPermissions.getState();
    serviceContainer.set(SERVICE_NAMES.TOOL_PERMISSIONS, updatedState);

    // Show a brief indicator of the mode change
    // This will be reflected in the ModeIndicator component
    return nextMode;
  };

  // Update shell mode state based on input
  const updateBashModeState = (text: string) => {
    const trimmed = text.trimStart();
    const isBash = trimmed.startsWith("!");
    setShowBashMode(isBash);
    if (isBash) {
      // Disable other helpers while in shell mode
      setShowSlashCommands(false);
      setShowFileSearch(false);
    }
  };

  // Update slash command UI state based on input
  const updateSlashCommandState = (text: string, cursor: number) => {
    // Only show slash commands if slash is the very first character
    if (!text.trimStart().startsWith("/")) {
      setShowSlashCommands(false);
      return;
    }

    // When using slash commands, disable file search
    setShowFileSearch(false);

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

    // Get the complete slash command from the text (not just before cursor)
    const afterSlash = trimmedText.slice(1).split(/[\s\n]/)[0];

    // We're in a slash command context - check if it's a complete command
    const allCommands = getSlashCommands();
    const exactMatch = allCommands.find((cmd) => cmd.name === afterSlash);

    // Hide selector if we have an exact match and there's any additional content
    if (exactMatch) {
      // Check if there's anything after the command name (space + args)
      const commandWithSlash = "/" + exactMatch.name;
      const textAfterCommand = trimmedText.slice(commandWithSlash.length);

      // If there's any content after the command name (space + args), hide dropdown
      if (
        textAfterCommand.trim().length > 0 &&
        beforeCursor.length >= commandWithSlash.length
      ) {
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

    // Disable file search if we're in shell mode or slash command mode
    const trimmed = text.trimStart();
    if (trimmed.startsWith("!") || trimmed.startsWith("/")) {
      setShowFileSearch(false);
      return;
    }

    // Check if we're in a file search context
    const beforeCursor = text.slice(0, cursor);

    // Find the first @ symbol that starts a file search context
    // We need to find the last @ that has no space before it (or is at word boundary)
    let firstAtIndex = -1;
    for (let i = beforeCursor.length - 1; i >= 0; i--) {
      if (beforeCursor[i] === "@") {
        // Check if this @ is at the start of a word (preceded by space/newline or start of string)
        const beforeAt = beforeCursor.slice(0, i);
        const lastChar = beforeAt[beforeAt.length - 1];
        if (i === 0 || lastChar === " " || lastChar === "\n") {
          // Check if there's any space/newline between this @ and cursor
          const afterThis = beforeCursor.slice(i + 1);
          if (!afterThis.includes(" ") && !afterThis.includes("\n")) {
            firstAtIndex = i;
            break;
          }
        }
      }
    }

    if (firstAtIndex === -1) {
      setShowFileSearch(false);
    } else {
      // Get ALL text after the @ symbol (including subsequent @ symbols)
      const afterAt = beforeCursor.slice(firstAtIndex + 1);

      // We're in a file search context
      setShowFileSearch(true);
      setFileSearchFilter(afterAt);
      setSelectedFileIndex(0);
      setShowSlashCommands(false);
      setShowBashMode(false);
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
      setShowBashMode(false);
    }
  };

  // Handle file selection
  const selectFile = async (filePath: string) => {
    const beforeCursor = inputText.slice(0, cursorPosition);

    // Find the first @ symbol that starts a file search context (same logic as updateFileSearchState)
    let firstAtIndex = -1;
    for (let i = beforeCursor.length - 1; i >= 0; i--) {
      if (beforeCursor[i] === "@") {
        // Check if this @ is at the start of a word (preceded by space/newline or start of string)
        const beforeAt = beforeCursor.slice(0, i);
        const lastChar = beforeAt[beforeAt.length - 1];
        if (i === 0 || lastChar === " " || lastChar === "\n") {
          // Check if there's any space/newline between this @ and cursor
          const afterThis = beforeCursor.slice(i + 1);
          if (!afterThis.includes(" ") && !afterThis.includes("\n")) {
            firstAtIndex = i;
            break;
          }
        }
      }
    }

    if (firstAtIndex !== -1) {
      const beforeAt = inputText.slice(0, firstAtIndex);
      const afterCursor = inputText.slice(cursorPosition);

      // Replace the partial file reference with the full file path
      const newText = beforeAt + "@" + filePath + " " + afterCursor;
      const newCursorPos = firstAtIndex + 1 + filePath.length + 1;

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
          // If file doesn't exist, just attach the filename without content
          if (error instanceof Error && (error as any).code === "ENOENT") {
            const path = await import("path");
            const absolutePath = path.resolve(filePath);
            onFileAttached(absolutePath, filePath);
          } else {
            console.error(`Error reading file ${filePath}:`, error);
          }
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
        const commandName = filteredCommands[selectedCommandIndex].name;
        if (key.return && commandName !== "title") {
          // select and submit the command
          const commandText = "/" + commandName;
          inputHistory.addEntry(commandText);

          // queue up when responding/generating
          if (!isRemoteMode && (isWaitingForResponse || isCompacting)) {
            void messageQueue.enqueueMessage(commandText);
          } else {
            onSubmit(commandText);
          }

          // reset after submitting command
          textBuffer.clear();
          setInputText("");
          setCursorPosition(0);
          setShowSlashCommands(false);
          setShowBashMode(false);
        } else {
          selectSlashCommand(commandName);
        }
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
      if (textBuffer.text.trim() || wasInterrupted) {
        // Get images before expanding paste blocks
        const imageMap = textBuffer.getAllImages();

        // Expand all paste blocks before submitting
        textBuffer.expandAllPasteBlocks();
        const submittedText = textBuffer.text.trim();

        inputHistory.addEntry(submittedText);

        // We don't queue, we just send in remote mode because the server handles queueing
        if (!isRemoteMode && (isWaitingForResponse || isCompacting)) {
          // Process message later when LLM has responded or compaction is complete
          void messageQueue.enqueueMessage(submittedText, imageMap);
        } else {
          // Submit with images
          onSubmit(submittedText, imageMap);
        }

        textBuffer.clear();
        setInputText("");
        setCursorPosition(0);
        setShowSlashCommands(false);
        setShowBashMode(false);
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

    escapeEvents.emit("user-escape");

    // If only "!" is present, clear shell mode
    if (inputMode && showBashMode && inputText.trim() === "!") {
      textBuffer.clear();
      setInputText("");
      setCursorPosition(0);
      setShowBashMode(false);
      return true;
    }

    // Handle escape key to interrupt compaction (higher priority)
    if (isCompacting && onInterrupt) {
      onInterrupt();
      return true;
    }

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

    // Handle double Esc to open edit message selector
    const now = Date.now();
    if (
      inputMode &&
      !showSlashCommands &&
      !showFileSearch &&
      !showBashMode &&
      onShowEditSelector &&
      now - lastEscapePressRef.current < 500
    ) {
      // Double escape detected
      onShowEditSelector();
      lastEscapePressRef.current = 0; // Reset to prevent triple-escape
      return true;
    }

    // Track single escape press
    lastEscapePressRef.current = now;

    return false;
  };

  // Handle text buffer updates for async operations like image pasting
  const handleTextBufferUpdate = () => {
    const newText = textBuffer.text;
    const newCursor = textBuffer.cursor;
    setInputText(newText);
    setCursorPosition(newCursor);
    updateSlashCommandState(newText, newCursor);
    updateFileSearchState(newText, newCursor);
    updateBashModeState(newText);
    inputHistory.resetNavigation();
  };

  // State for showing image paste hint
  const [_hasImageInClipboard, _setHasImageInClipboard] = useState(false);

  // Monitor clipboard for images and show helpful hints
  const { checkNow: _checkClipboardNow } = useClipboardMonitor({
    onImageStatusChange: (hasImage) => {
      _setHasImageInClipboard(hasImage);
      // Also notify parent component
      if (onImageInClipboardChange) {
        onImageInClipboardChange(hasImage);
      }
    },
    enabled: !disabled && inputMode,
    pollInterval: 2000,
  });

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
        textBuffer,
        onTextBufferUpdate: handleTextBufferUpdate,
      })
    ) {
      return;
    }

    // Handle escape key variations
    if (handleEscapeKey(key)) {
      return;
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
      updateBashModeState,
      inputHistory,
    });
  });

  const renderInputText = () => {
    const placeholderText = isRemoteMode
      ? "Ask anything, / for slash commands, ! for shell mode"
      : placeholder ||
        "Ask anything, @ for context, / for slash commands, ! for shell mode";
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
      <InterruptedBanner wasInterrupted={!!wasInterrupted} />

      {/* Input box */}
      <Box
        borderStyle="round"
        borderTop={true}
        paddingX={1}
        borderColor={showBashMode ? "yellow" : isRemoteMode ? "cyan" : "gray"}
      >
        <Text
          color={showBashMode ? "yellow" : isRemoteMode ? "cyan" : "blue"}
          bold
        >
          {showBashMode ? "$ " : isRemoteMode ? "◉ " : "● "}
        </Text>
        {renderInputText()}
      </Box>

      <SlashCommandsMaybe
        show={showSlashCommands}
        inputMode={inputMode}
        hideNormalUI={!!hideNormalUI}
        isRemoteMode={!!isRemoteMode}
        assistant={assistant}
        filter={slashCommandFilter}
        selectedIndex={selectedCommandIndex}
      />

      <FileSearchMaybe
        show={showFileSearch}
        inputMode={inputMode}
        hideNormalUI={!!hideNormalUI}
        isRemoteMode={!!isRemoteMode}
        filter={fileSearchFilter}
        selectedIndex={selectedFileIndex}
        onSelect={selectFile}
        onFilesUpdated={setCurrentFiles}
      />
    </Box>
  );
};

export { UserInput };
