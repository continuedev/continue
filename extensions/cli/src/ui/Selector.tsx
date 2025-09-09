import { Box, Text, useInput } from "ink";
import React, { ReactNode } from "react";

import { defaultBoxStyles } from "./styles.js";

export interface SelectorOption {
  id: string;
  name: string;
  displaySuffix?: string;
}

interface SelectorProps<T extends SelectorOption> {
  title: string;
  options: T[];
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  loadingMessage?: string;
  currentId?: string | null;
  onSelect: (option: T) => void;
  onCancel: () => void;
  onNavigate: (newIndex: number) => void;
  renderOption?: (
    option: T,
    isSelected: boolean,
    isCurrent: boolean,
  ) => ReactNode;
}

export function Selector<T extends SelectorOption>({
  title,
  options,
  selectedIndex,
  loading,
  error,
  loadingMessage = "Loading...",
  currentId,
  onSelect,
  onCancel,
  onNavigate,
  renderOption,
}: SelectorProps<T>) {
  // Handle input for loading and error states
  useInput((input, key) => {
    if (loading || error) {
      if (key.escape || (key.ctrl && input === "c")) {
        onCancel();
        return;
      }
    }
  });

  useInput((input, key) => {
    if (loading || error) return; // Skip normal input handling during loading/error

    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    if (key.return) {
      const selectedOption = options[selectedIndex];
      if (selectedOption) {
        onSelect(selectedOption);
      }
      return;
    }

    // loop back to the first option after the last option, and vice versa
    if (key.upArrow) {
      onNavigate(selectedIndex === 0 ? options.length - 1 : selectedIndex - 1);
    } else if (key.downArrow) {
      onNavigate(selectedIndex === options.length - 1 ? 0 : selectedIndex + 1);
    }
  });

  if (loading) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="blue" bold>
          {title}
        </Text>
        <Text> </Text>
        <Text italic color="gray">
          {loadingMessage}
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="red" bold>
          Error
        </Text>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>
          Press Esc to cancel
        </Text>
      </Box>
    );
  }

  const defaultRenderOption = (
    option: T,
    isSelected: boolean,
    isCurrent: boolean,
  ) => (
    <>
      <Text
        color={isSelected ? "blue" : isCurrent ? "green" : "white"}
        bold={isSelected}
      >
        {isSelected ? "➤ " : "  "}
        {option.name}
        {option.displaySuffix || ""}
      </Text>
      {isCurrent && (
        <Text bold color="green">
          {" ✔"}
        </Text>
      )}
    </>
  );

  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        {title}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = currentId === option.id;
          const render = renderOption || defaultRenderOption;

          return (
            <Box key={option.id}>{render(option, isSelected, isCurrent)}</Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑/↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
