import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { getToolDisplayName } from "../../tools.js";

interface PermissionOption {
  id: string;
  name: string;
  color: string;
  approved: boolean;
}

interface ToolPermissionSelectorProps {
  toolName: string;
  toolArgs: any;
  requestId: string;
  onResponse: (requestId: string, approved: boolean) => void;
}

const PERMISSION_OPTIONS: PermissionOption[] = [
  { id: "approve", name: "Continue", color: "green", approved: true },
  { id: "deny", name: "Cancel", color: "red", approved: false },
];

export const ToolPermissionSelector: React.FC<ToolPermissionSelectorProps> = ({
  toolName,
  toolArgs,
  requestId,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.return) {
      const selectedOption = PERMISSION_OPTIONS[selectedIndex];
      onResponse(requestId, selectedOption.approved);
      return;
    }

    // Tab to continue (approve)
    if (key.tab) {
      onResponse(requestId, true);
      return;
    }

    // Escape to reject (deny)
    if (key.escape) {
      onResponse(requestId, false);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(
        Math.min(PERMISSION_OPTIONS.length - 1, selectedIndex + 1)
      );
    }

    // Also support y/n for quick responses
    if (input === "y" || input === "Y") {
      onResponse(requestId, true);
    } else if (input === "n" || input === "N") {
      onResponse(requestId, false);
    }
  });

  const formatArgs = (args: any) => {
    if (!args || Object.keys(args).length === 0) return "";

    const firstKey = Object.keys(args)[0];
    const firstValue = args[firstKey];

    if (typeof firstValue === "string" && firstValue.length > 60) {
      return `${firstValue.substring(0, 60)}...`;
    }

    return String(firstValue);
  };

  const formattedArgs = formatArgs(toolArgs);
  const displayName = getToolDisplayName(toolName);

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="magenta"
    >
      <Text color="magenta" bold>
        {displayName}({formattedArgs})
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text color="dim">Would you like to continue?</Text>
        {PERMISSION_OPTIONS.map((option, index) => {
          const isSelected = index === selectedIndex;
          const shortcut = option.approved ? "(tab)" : "(esc)";
          return (
            <Box key={option.id} marginTop={index === 0 ? 1 : 0}>
              <Text
                color={isSelected ? option.color : "white"}
                bold={isSelected}
              >
                {isSelected ? "> " : "  "}
                {option.name}
              </Text>
              <Text color="gray" dimColor>
                {" "}
                {shortcut}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
