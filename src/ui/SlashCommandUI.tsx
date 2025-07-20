import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import {
  getAllSlashCommands,
  type SlashCommand,
} from "../commands/commands.js";

interface SlashCommandUIProps {
  assistant: AssistantConfig;
  filter: string;
  selectedIndex: number;
}

const SlashCommandUI: React.FC<SlashCommandUIProps> = ({
  assistant,
  filter,
  selectedIndex,
}) => {
  const [allCommands, setAllCommands] = useState<SlashCommand[]>([]);

  useEffect(() => {
    setAllCommands(getAllSlashCommands(assistant));
  }, [assistant]);

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

        return (
          <Box key={command.name}>
            <Text color="white" bold={isSelected}>
              {"  "}
              <Text color="green">/{command.name}</Text>
              <Text color="gray"> - {command.description}</Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑/↓ to navigate, Enter to select, Tab to complete
        </Text>
      </Box>
    </Box>
  );
};

export default SlashCommandUI;
