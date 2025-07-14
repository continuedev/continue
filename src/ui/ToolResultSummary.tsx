import { Box, Text } from "ink";
import React from "react";

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

    // Use exact tool name matching
    switch (toolName) {
      // CLI Internal Tools (snake_case)
      case "read_file":
        // Try to extract file path from content if it contains line numbers
        if (content.includes("→")) {
          const pathMatch = content.match(/^(.+?):/);
          const filePath = pathMatch ? pathMatch[1] : "file";
          return `Read ${filePath} (${lines} lines)`;
        }
        return `Read tool output (${lines} lines)`;

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
        // Handle MCP tools or unknown tools
        if (toolName?.startsWith("mcp__")) {
          const mcpToolName = toolName
            .replace("mcp__", "")
            .replace("ide__", "");
          return `${mcpToolName} tool output (${lines} lines)`;
        }

        // Fallback for unknown tools
        if (chars > 1000) {
          return `${
            toolName || "Tool"
          } output: ${lines} lines, ${chars} characters`;
        } else if (lines > 10) {
          return `${toolName || "Tool"} output: ${lines} lines`;
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
