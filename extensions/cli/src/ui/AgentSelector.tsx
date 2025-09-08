import { Box, Text, useInput } from "ink";
import React, { useMemo, useState } from "react";

import { useTerminalSize } from "./hooks/useTerminalSize.js";
import { defaultBoxStyles } from "./styles.js";

export interface Agent {
  id: string;
  name: string;
  description?: string;
  slug: string;
  createdAt?: string;
}

interface AgentSelectorProps {
  agents: Agent[];
  onSelect: (agentSlug: string) => void;
  onExit: () => void;
}

export function AgentSelector({ agents, onSelect, onExit }: AgentSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { rows: terminalHeight } = useTerminalSize();

  // Calculate how many agents we can display based on terminal height
  const displayAgents = useMemo(() => {
    // Reserve 5 lines for header and instructions, each agent takes 3 lines (2 content + 1 spacer)
    const availableHeight = Math.max(1, terminalHeight - 5);
    const maxDisplayableAgents = Math.floor(availableHeight / 3);

    return agents.slice(0, maxDisplayableAgents);
  }, [agents, terminalHeight]);

  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : displayAgents.length - 1,
      );
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((prev) =>
        prev < displayAgents.length - 1 ? prev + 1 : 0,
      );
    } else if (key.return) {
      if (displayAgents[selectedIndex]) {
        onSelect(displayAgents[selectedIndex].slug);
      }
    } else if (key.escape || (key.ctrl && input === "d")) {
      onExit();
    }
  });

  if (agents.length === 0) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="yellow">No agents found.</Text>
        <Text color="gray">Press Esc to exit</Text>
      </Box>
    );
  }

  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        Available Agents
      </Text>
      <Text color="gray">↑/↓ to navigate, Enter to select, Esc to exit</Text>
      <Text> </Text>

      {displayAgents.map((agent, index) => {
        const isSelected = index === selectedIndex;
        const indicator = isSelected ? "➤ " : "  ";
        const color = isSelected ? "blue" : "white";

        return (
          <Box key={agent.id} flexDirection="column">
            <Box paddingRight={3}>
              <Text bold={isSelected} color={color} wrap="truncate-end">
                {indicator}
                {agent.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">
                {agent.description || `Agent: ${agent.slug}`}
              </Text>
            </Box>
            {index < displayAgents.length - 1 && (
              <Text key={`spacer-${agent.id}`}> </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}