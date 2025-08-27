import { Box, Text, useInput } from "ink";
import React, { ReactNode } from "react";

export interface SelectorOption {
  id: string;
  name: string;
  displaySuffix?: string;
}

const boxStyles: React.ComponentProps<typeof Box> = {
  flexDirection: "column",
  paddingX: 2,
  paddingY: 1,
  borderStyle: "round",
  borderColor: "blue",
};

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
  useInput((input, key) => {
    if (key.escape) {
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
      <Box {...boxStyles}>
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
      <Box {...boxStyles}>
        <Text color="red" bold>
          Error
        </Text>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>
          Press Escape to cancel
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
        {isSelected ? "→ " : "  "}
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
    <Box {...boxStyles}>
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
          ↑/↓ to navigate, Enter to select, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
}
