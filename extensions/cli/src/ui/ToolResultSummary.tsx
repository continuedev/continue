import path from "path";

import { Box, Text } from "ink";
import React from "react";

import { getToolDisplayName } from "../tools/index.js";

import { ColoredDiff } from "./ColoredDiff.js";
import { ChecklistDisplay } from "./components/ChecklistDisplay.js";

interface ToolResultSummaryProps {
  toolName?: string;
  content: string;
}

const ToolResultSummary: React.FC<ToolResultSummaryProps> = ({
  toolName,
  content,
}) => {
  if (!content) {
    return (
      <Box>
        <Text color="gray">⎿ </Text>
        <Text color="gray"> No output</Text>
      </Box>
    );
  }

  const lines = content.split("\n").length;
  const chars = content.length;
  const displayName = toolName ? getToolDisplayName(toolName) : "Tool";

  // Handle Checklist specially with styled display
  if (toolName === "Checklist") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="gray">⎿ </Text>
          <Text color="blue">Task List Updated</Text>
        </Box>
        <ChecklistDisplay content={`Task list status:\n${content}`} />
      </Box>
    );
  }

  // Handle Write/Edit/MultiEdit with diff specially
  if (
    (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") &&
    content.includes("Diff:\n")
  ) {
    const diffSection = content.split("Diff:\n")[1];
    if (diffSection) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="gray">⎿ </Text>
            <Text color="green">
              {toolName === "Edit"
                ? " File edited successfully"
                : toolName === "MultiEdit"
                  ? " File edited successfully"
                  : " File written successfully"}
            </Text>
          </Box>
          <ColoredDiff diffContent={diffSection} />
        </Box>
      );
    }
  }

  // Handle terminal command output specially
  if (toolName === "Bash") {
    const isStderr = content.startsWith("Stderr:");
    const actualOutput = isStderr ? content.slice(7).trim() : content;
    const outputLines = actualOutput.split("\n");

    if (outputLines.length <= 16) {
      // Show actual output for 16 lines or fewer
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="gray">⎿ </Text>
            <Text color="gray"> Terminal output:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={isStderr ? "red" : "white"}>{actualOutput}</Text>
          </Box>
        </Box>
      );
    } else {
      // Show first 16 lines with ellipsis for more than 16 lines
      const first16Lines = outputLines.slice(0, 16).join("\n");
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="gray">⎿ </Text>
            <Text color="gray"> Terminal output:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color={isStderr ? "red" : "white"}>{first16Lines}</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text color="gray">...</Text>
          </Box>
        </Box>
      );
    }
  }

  // Handle all other cases with text summary
  const getSummary = () => {
    // Check if this is a user cancellation first
    if (content === "Permission denied by user") {
      return "Cancelled by user";
    }

    // Check if it was an error
    if (content.startsWith("Error")) {
      const lines = content.split("\n");
      return `Error: ${lines[0]}${lines.length > 1 ? "..." : ""}`;
    }

    // Convert absolute paths to relative paths from workspace root
    const formatPath = (filePath: string) => {
      if (path.isAbsolute(filePath)) {
        const workspaceRoot = process.cwd();
        const relativePath = path.relative(workspaceRoot, filePath);
        return relativePath || filePath;
      }
      return filePath;
    };

    // Handle specific tool output formatting
    switch (toolName) {
      case "Read":
        // Try to extract file path from content if it contains line numbers
        if (content.includes("→")) {
          const pathMatch = content.match(/^(.+?):/);
          const filePath = pathMatch ? pathMatch[1] : "file";
          return `${displayName} ${formatPath(filePath)} (${lines} lines)`;
        }
        return `${displayName} tool output (${lines} lines)`;

      case "Write":
        return content.includes("Successfully created file")
          ? "File created successfully"
          : "File updated successfully";

      case "Edit":
        return "File edited successfully";

      case "MultiEdit":
        return "File edited successfully";

      case "List":
        return `Listed ${lines} ${lines === 1 ? "item" : "items"}`;

      case "Search":
        return `Found ${lines} ${lines === 1 ? "match" : "matches"}`;

      case "Diff":
        return `Diff output (${lines} lines)`;

      default:
        // Fallback for all tools using display name
        if (chars > 1000) {
          return `${displayName} output: ${lines} lines, ${chars} characters`;
        } else if (lines > 10) {
          return `${displayName} output: ${lines} lines`;
        } else {
          return content.slice(0, 100) + (content.length > 100 ? "..." : "");
        }
    }
  };

  return (
    <Box>
      <Text color="gray">⎿ </Text>
      <Text color="gray"> {getSummary()}</Text>
    </Box>
  );
};

export { ToolResultSummary };
