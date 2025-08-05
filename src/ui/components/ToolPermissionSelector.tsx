import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

import { formatToolCall } from "../../tools/index.js";
import { ToolCallPreview } from "../../tools/types.js";

import { ToolPreview } from "./ToolPreview.js";

interface PermissionOption {
  id: string;
  name: string;
  color: string;
  approved: boolean;
  createPolicy?: boolean;
}

interface ToolPermissionSelectorProps {
  toolName: string;
  toolArgs: any;
  requestId: string;
  toolCallPreview?: ToolCallPreview[];
  onResponse: (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean
  ) => void;
}

const PERMISSION_OPTIONS: PermissionOption[] = [
  { id: "approve", name: "Continue", color: "green", approved: true },
  {
    id: "approve_policy",
    name: "Continue + don't ask again",
    color: "cyan",
    approved: true,
    createPolicy: true,
  },
  { id: "deny", name: "Cancel", color: "red", approved: false },
];

export const ToolPermissionSelector: React.FC<ToolPermissionSelectorProps> = ({
  toolName,
  toolArgs,
  requestId,
  toolCallPreview,
  onResponse,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.return) {
      const selectedOption = PERMISSION_OPTIONS[selectedIndex];
      onResponse(
        requestId,
        selectedOption.approved,
        selectedOption.createPolicy
      );
      return;
    }

    // Tab to continue (approve)
    if (key.tab && !key.shift) {
      onResponse(requestId, true, false);
      return;
    }

    // Shift+Tab to continue with policy creation
    if (key.tab && key.shift) {
      onResponse(requestId, true, true);
      return;
    }

    // Escape to reject (deny)
    if (key.escape) {
      onResponse(requestId, false, false);
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
      onResponse(requestId, true, false);
    } else if (input === "n" || input === "N") {
      onResponse(requestId, false, false);
    }
  });

  const toolCallDisplay = formatToolCall(toolName, toolArgs);

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="magenta"
    >
      <Text color="magenta" bold>
        {toolCallDisplay}
      </Text>

      {/* Show preview of what the tool will do */}
      <Box marginTop={1}>
        <ToolPreview
          toolName={toolName}
          toolArgs={toolArgs}
          toolCallPreview={toolCallPreview}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="dim">Would you like to continue?</Text>
        {PERMISSION_OPTIONS.map((option, index) => {
          const isSelected = index === selectedIndex;
          let shortcut = "";
          if (option.id === "approve") shortcut = "(tab)";
          else if (option.id === "approve_policy") shortcut = "(shift+tab)";
          else if (option.id === "deny") shortcut = "(esc)";

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
