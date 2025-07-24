import { Box, Text, useInput } from "ink";
import React, { ReactNode } from "react";

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
  renderOption?: (option: T, isSelected: boolean, isCurrent: boolean) => ReactNode;
}

export default function Selector<T extends SelectorOption>({
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

    if (key.upArrow) {
      onNavigate(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      onNavigate(Math.min(options.length - 1, selectedIndex + 1));
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Text color="blue" bold>
          {title}
        </Text>
        <Text color="gray">{loadingMessage}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="red"
      >
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

  const defaultRenderOption = (option: T, isSelected: boolean, isCurrent: boolean) => (
    <Text
      color={isSelected ? "blue" : "white"}
      bold={isSelected}
      inverse={isSelected}
    >
      {isSelected ? "▶ " : "  "}
      {option.name}
      {option.displaySuffix || ""}
      {isCurrent ? " (current)" : ""}
    </Text>
  );

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="blue"
    >
      <Text color="blue" bold>
        {title}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = currentId === option.id;
          const render = renderOption || defaultRenderOption;

          return (
            <Box key={option.id}>
              {render(option, isSelected, isCurrent)}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑/↓ to navigate, Enter to select, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
}