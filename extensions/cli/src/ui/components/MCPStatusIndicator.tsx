import { Box, Text } from "ink";
import React from "react";

import type { MCPService } from "../../services/MCPService.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";

interface MCPStatusIndicatorProps {
  mcpService: MCPService | undefined;
  visible?: boolean;
}

export const MCPStatusIndicator: React.FC<MCPStatusIndicatorProps> = ({
  mcpService,
  visible = true,
}) => {
  const { columns } = useTerminalSize();

  // Only show on wide screens (>60 columns as per requirement)
  if (!mcpService || !visible || columns <= 60) {
    return null;
  }

  // Get current state and check for failed servers
  const state = mcpService.getState();
  const failedServers = state.connections.filter(
    (connection) => connection.status === "error",
  );

  if (failedServers.length === 0) {
    return null;
  }

  // Generate the message based on number of failed servers
  const message =
    failedServers.length === 1
      ? `${failedServers[0].config?.name || "MCP server"} failed to start, /mcp to configure`
      : `${failedServers.length} MCP servers failed to start, /mcp to configure`;

  return (
    <Box justifyContent="flex-end" paddingX={1}>
      <Text color="yellow">{message}</Text>
    </Box>
  );
};
