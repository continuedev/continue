import { Box, Text } from "ink";
import React from "react";

import { getToolDisplayName } from "../../tools/index.js";
import { ToolCallPreview } from "../../tools/types.js";
// Using simplified rendering for tool preview

interface ToolPreviewProps {
  toolCallPreview?: ToolCallPreview[];
  toolName: string;
  toolArgs: any;
}

/**
 * Generates a preview of what a tool will do based on its arguments
 */
export const ToolPreview: React.FC<ToolPreviewProps> = ({
  toolCallPreview,
  toolName,
  toolArgs,
}) => {
  if (toolCallPreview) {
    return (
      <Box display={"flex"} flexDirection="column" marginTop={1}>
        {toolCallPreview.map((preview, index) => {
          if (preview.type === "text") {
            return (
              <Box key={index} paddingLeft={preview.paddingLeft ?? 0}>
                {index === 0 && <Text color="gray">⎿ </Text>}
                <Text color={preview.color ?? "gray"}>{preview.content}</Text>
              </Box>
            );
          } else if (preview.type === "checklist") {
            return (
              <Box key={index}>
                <Text color="gray">{`Task list status:\n${preview.content}`}</Text>
              </Box>
            );
          } else {
            // Simplified diff display without syntax highlighting
            return (
              <Box key={index}>
                <Text color="gray">{preview.content}</Text>
              </Box>
            );
          }
        })}
      </Box>
    );
  }

  let message = `Will call ${getToolDisplayName(toolName)}`;
  const argCount = Object.keys(toolArgs || {}).length;
  if (argCount > 0) {
    message += ` with ${argCount} argument${argCount === 1 ? "" : "s"}`;
  }

  return (
    <Box>
      <Text color="gray">⎿ </Text>
      <Text color="gray">{message}</Text>
    </Box>
  );
};
