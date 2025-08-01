import { Box, Text } from "ink";
import React from "react";
import { MCPServiceState } from "../../services/types.js";

interface MCPStatusIndicatorProps {
  mcpState: MCPServiceState | null;
}

const MCPStatusIndicator: React.FC<MCPStatusIndicatorProps> = ({ mcpState }) => {
  if (!mcpState?.mcpService || mcpState.connections.length === 0) {
    return null;
  }

  // Determine overall status and color
  const hasConnecting = mcpState.connections.some(c => c.status === 'connecting');
  const hasError = mcpState.connections.some(c => c.status === 'error');
  const hasConnected = mcpState.connections.some(c => c.status === 'connected');
  const hasWarnings = mcpState.connections.some(c => c.warnings.length > 0);

  let statusChar = "●";
  let color = "gray";

  if (hasConnecting) {
    statusChar = "◐"; // Loading spinner character
    color = "yellow";
  } else if (hasError) {
    color = "red";
  } else if (hasConnected) {
    color = hasWarnings ? "yellow" : "green";
  }

  return (
    <Box flexDirection="row" alignItems="center">
      <Text color="dim">MCP</Text>
      <Text color={color}>{statusChar}</Text>
    </Box>
  );
};

export default MCPStatusIndicator;