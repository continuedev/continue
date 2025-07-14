import { Box, Text } from "ink";
import path from "path";
import React from "react";
import { getToolDisplayName } from "../tools.js";

interface ToolResultSummaryProps {
  toolName?: string;
  content: string;
}

const ToolResultSummary: React.FC<ToolResultSummaryProps> = ({
  toolName,
  content,
}) => {
  const getSummary = () => {
    if (!content) return "No output";

    const lines = content.split("\n").length;
    const chars = content.length;
    const displayName = toolName ? getToolDisplayName(toolName) : "Tool";

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
      case "read_file":
        // Try to extract file path from content if it contains line numbers
        if (content.includes("→")) {
          const pathMatch = content.match(/^(.+?):/);
          const filePath = pathMatch ? pathMatch[1] : "file";
          return `${displayName} ${formatPath(filePath)} (${lines} lines)`;
        }
        return `${displayName} tool output (${lines} lines)`;

      case "write_file":
        return "File written successfully";

      case "list_files":
        return `Listed ${lines} ${lines === 1 ? "item" : "items"}`;

      case "search_code":
        return `Found ${lines} ${lines === 1 ? "match" : "matches"}`;

      case "run_terminal_command":
        return `Command output (${lines} lines)`;

      case "view_diff":
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

export default ToolResultSummary;
