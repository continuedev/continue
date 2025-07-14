import { type AssistantConfig } from "@continuedev/sdk";
import { Box, Text } from "ink";
import React from "react";

interface SlashCommandUIProps {
  assistant: AssistantConfig;
  filter: string;
  selectedIndex: number;
  onSelect: (command: string) => void;
}

interface SlashCommand {
  name: string;
  description: string;
  category: "system" | "assistant";
}

const SlashCommandUI: React.FC<SlashCommandUIProps> = ({
  assistant,
  filter,
  selectedIndex,
  onSelect,
}) => {
  // Get all available slash commands
  const getSlashCommands = (): SlashCommand[] => {
    const systemCommands: SlashCommand[] = [
      { name: "help", description: "Show help message", category: "system" },
      { name: "exit", description: "Exit the chat", category: "system" },
      {
        name: "login",
        description: "Authenticate with your account",
        category: "system",
      },
      {
        name: "logout",
        description: "Sign out of your current session",
        category: "system",
      },
      {
        name: "whoami",
        description: "Check who you're currently logged in as",
        category: "system",
      },
      {
        name: "models",
        description: "List available AI models",
        category: "system",
      },
    ];

    const assistantCommands: SlashCommand[] =
      assistant.prompts?.map((prompt) => ({
        name: prompt?.name || "",
        description: prompt?.description || "",
        category: "assistant" as const,
      })) || [];

    return [...systemCommands, ...assistantCommands];
  };

  const allCommands = getSlashCommands();

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
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginX={1}
        marginBottom={1}
      >
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
