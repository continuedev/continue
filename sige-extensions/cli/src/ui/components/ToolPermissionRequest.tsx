import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

interface ToolPermissionRequestProps {
  toolName: string;
  toolArgs: any;
  requestId: string;
  onResponse: (requestId: string, approved: boolean) => void;
}

export const ToolPermissionRequest: React.FC<ToolPermissionRequestProps> = ({
  toolName,
  toolArgs,
  requestId,
  onResponse,
}) => {
  const [responded, setResponded] = useState(false);

  useInput((input) => {
    if (responded) return;

    if (input === "y" || input === "Y") {
      setResponded(true);
      onResponse(requestId, true);
    } else if (input === "n" || input === "N") {
      setResponded(true);
      onResponse(requestId, false);
    }
  });

  if (responded) {
    return null; // Component will be replaced by updated message
  }

  const formatArgs = (args: any) => {
    if (!args || Object.keys(args).length === 0) return "";

    const firstKey = Object.keys(args)[0];
    const firstValue = args[firstKey];

    if (typeof firstValue === "string" && firstValue.length > 50) {
      return `${firstValue.substring(0, 50)}...`;
    }

    return String(firstValue);
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="yellow">⚠ </Text>
        <Text color="yellow" bold>
          Permission Required
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text>
          Tool: <Text color="cyan">{toolName}</Text>
        </Text>
      </Box>
      {formatArgs(toolArgs) && (
        <Box marginLeft={2}>
          <Text>
            Args: <Text color="gray">{formatArgs(toolArgs)}</Text>
          </Text>
        </Box>
      )}
      <Box marginLeft={2}>
        <Text>
          Allow this tool call? (
          <Text color="green" bold>
            y
          </Text>
          /
          <Text color="red" bold>
            n
          </Text>
          )
        </Text>
      </Box>
    </Box>
  );
};
