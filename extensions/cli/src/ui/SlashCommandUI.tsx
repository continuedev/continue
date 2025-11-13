import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text } from "ink";
import React, { useMemo } from "react";

import { getAllSlashCommands } from "../commands/commands.js";

const MAX_DESCRIPTION_LENGTH = 80;

const truncateDescription = (description: string): string => {
  if (description.length <= MAX_DESCRIPTION_LENGTH) {
    return description;
  }
  return (
    Array.from(description).slice(0, MAX_DESCRIPTION_LENGTH).join("").trim() +
    "…"
  );
};

interface SlashCommandUIProps {
  assistant?: AssistantConfig;
  filter: string;
  selectedIndex: number;
  isRemoteMode?: boolean;
}

const SlashCommandUI: React.FC<SlashCommandUIProps> = ({
  assistant,
  filter,
  selectedIndex,
  isRemoteMode = false,
}) => {
  // Memoize the slash commands to prevent excessive re-renders
  const allCommands = useMemo(() => {
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
  }, [isRemoteMode, assistant?.prompts, assistant?.rules]);

  // Filter commands based on the current filter
  const filteredCommands = allCommands
    .filter((cmd) => cmd.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(filter.toLowerCase());
      const bStartsWith = b.name.toLowerCase().startsWith(filter.toLowerCase());

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return a.name.localeCompare(b.name);
    });

  if (filteredCommands.length === 0) {
    return (
      <Box paddingX={1} marginX={1} marginBottom={1}>
        <Text color="gray">No matching commands found</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} marginX={1} marginBottom={1} flexDirection="column">
      {filteredCommands.map((command, index) => {
        const isSelected = index === selectedIndex;

        // Find the longest command name to vertically align command descriptions
        const maxCommandLength = Math.max(
          ...filteredCommands.map((cmd) => cmd.name.length),
        );
        const paddedCommandName = `/${command.name}`.padEnd(
          maxCommandLength + 1,
        );

        return (
          <Box key={command.name}>
            <Text color={isSelected ? "blue" : "white"} bold={isSelected}>
              {"  "}
              {paddedCommandName}
              <Text color={isSelected ? "blue" : "gray"}>
                {"    "}
                {truncateDescription(command.description)}
              </Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑/↓ to navigate, Enter to select, Tab to complete
        </Text>
      </Box>
    </Box>
  );
};

export { SlashCommandUI };
