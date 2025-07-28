import { createTwoFilesPatch } from "diff";
import * as fs from "fs";
import { Box, Text } from "ink";
import React from "react";
import { formatToolCall, formatToolArgument } from "../../tools/formatters.js";
import { getToolDisplayName } from "../../tools.js";
import { ColoredDiff } from "../ColoredDiff.js";

interface ToolPreviewProps {
  toolName: string;
  toolArgs: any;
}

/**
 * Generates a preview of what a tool will do based on its arguments
 */
export const ToolPreview: React.FC<ToolPreviewProps> = ({
  toolName,
  toolArgs,
}) => {
  const getPreview = () => {
    // For tool calls that match the standard format, use formatToolCall
    if (toolName === "read_file" || toolName === "write_file" || toolName === "edit_file") {
      return formatToolCall(toolName, toolArgs);
    }

    switch (toolName) {
      case "list_files":
        if (toolArgs.directory) {
          return `Will list files in: ${formatToolArgument(toolArgs.directory)}`;
        }
        return "Will list files in current directory";

      case "search_code":
        if (toolArgs.pattern) {
          const truncatedPattern =
            toolArgs.pattern.length > 50
              ? toolArgs.pattern.substring(0, 50) + "..."
              : toolArgs.pattern;
          return `Will search for: "${truncatedPattern}"`;
        }
        return "Will search the codebase";

      case "run_terminal_command":
        if (toolArgs.command) {
          const truncatedCmd =
            toolArgs.command.length > 60
              ? toolArgs.command.substring(0, 60) + "..."
              : toolArgs.command;
          return `Will run: ${truncatedCmd}`;
        }
        return "Will run a terminal command";

      case "fetch":
        if (toolArgs.url) {
          return `Will fetch: ${toolArgs.url}`;
        }
        return "Will fetch from a URL";

      case "view_diff":
        return "Will show git diff";

      default:
        // For unknown tools, show what args will be passed
        const argCount = Object.keys(toolArgs || {}).length;
        if (argCount > 0) {
          return `Will call ${getToolDisplayName(
            toolName
          )} with ${argCount} argument${argCount !== 1 ? "s" : ""}`;
        }
        return `Will call ${getToolDisplayName(toolName)}`;
    }
  };

  return (
    <Box>
      <Text color="gray">⎿ </Text>
      <Text color="gray">{getPreview()}</Text>
    </Box>
  );
};

/**
 * Shows a detailed preview for tools where we can predict the output
 */
export const DetailedToolPreview: React.FC<ToolPreviewProps> = ({
  toolName,
  toolArgs,
}) => {
  // For edit operations, we could show a diff preview if we have old_string/new_string
  if (toolName === "edit_file" && toolArgs.old_string && toolArgs.new_string) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="column" paddingLeft={2}>
          <Text color="red">- {toolArgs.old_string.split("\n")[0]}</Text>
          <Text color="green">+ {toolArgs.new_string.split("\n")[0]}</Text>
          {(toolArgs.old_string.split("\n").length > 1 ||
            toolArgs.new_string.split("\n").length > 1) && (
            <Text color="gray"> ...</Text>
          )}
        </Box>
      </Box>
    );
  }

  // For write operations, show diff preview if file exists
  if (toolName === "write_file" && toolArgs.filepath && toolArgs.content) {
    try {
      if (fs.existsSync(toolArgs.filepath)) {
        const oldContent = fs.readFileSync(toolArgs.filepath, "utf-8");
        const newContent = toolArgs.content;

        // Generate a diff preview
        const diff = createTwoFilesPatch(
          toolArgs.filepath,
          toolArgs.filepath,
          oldContent,
          newContent,
          undefined,
          undefined,
          { context: 2 }
        );

        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray">Preview of changes:</Text>
            <ColoredDiff diffContent={diff} />
          </Box>
        );
      } else {
        // New file - show content preview
        const lines = toolArgs.content.split("\n");
        const preview = lines.slice(0, 3);

        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray">New file content:</Text>
            <Box flexDirection="column" paddingLeft={2}>
              {preview.map((line: string, i: number) => (
                <Text key={i} color="green">
                  {line || " "}
                </Text>
              ))}
              {lines.length > 3 && (
                <Text color="gray">... ({lines.length - 3} more lines)</Text>
              )}
            </Box>
          </Box>
        );
      }
    } catch (error) {
      // If we can't read the file, just show a simple preview
      const lines = toolArgs.content.split("\n");
      return (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Content preview ({lines.length} lines)</Text>
        </Box>
      );
    }
  }

  return null;
};
