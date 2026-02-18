import { Text } from "ink";
import React from "react";

import { formatToolArgument } from "./formatters.js";

import { getToolDisplayName } from "./index.js";

/**
 * Formats a tool call with its arguments for display
 * @param toolName The name of the tool
 * @param args The tool arguments
 * @returns A React node with bolded tool name like "<b>ToolName</b>(arg)" or just "<b>ToolName</b>" if no args
 */
export function ToolCallTitle(props: { toolName: string; args?: any }) {
  const { toolName, args } = props;

  const displayName = getToolDisplayName(toolName);

  if (!args || Object.keys(args).length === 0) {
    return <Text bold>{displayName}</Text>;
  }

  // Get the first argument value if it's a simple one
  let formattedValue = "";
  const [key, value] = Object.entries(args)[0];
  if (
    key.toLowerCase().includes("path") ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    formattedValue = formatToolArgument(value);
  } else if (typeof value === "string") {
    const valueLines = value.split("\n");
    if (valueLines.length === 1) {
      formattedValue = formatToolArgument(value);
    } else {
      // For multi-line strings, show first line with ellipsis
      const firstLine = valueLines[0].trim();
      formattedValue = firstLine
        ? `${formatToolArgument(firstLine)}...`
        : "...";
    }
  }

  return (
    <Text wrap="truncate">
      <Text bold>{displayName}</Text>({formattedValue})
    </Text>
  );
}
