import { Text } from "ink";
import React, { useMemo } from "react";

import { useServices } from "../hooks/useService.js";
import {
  MCPServiceState,
  SERVICE_NAMES,
  UpdateServiceState,
  UpdateStatus,
} from "../services/types.js";

import { useTerminalSize } from "./hooks/useTerminalSize.js";

interface UpdateNotificationProps {
  isRemoteMode?: boolean;
}
const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  isRemoteMode = false,
}) => {
  const { columns } = useTerminalSize();

  const { services } = useServices<{
    update: UpdateServiceState;
    mcp: MCPServiceState;
  }>([SERVICE_NAMES.UPDATE, SERVICE_NAMES.MCP]);

  const color = useMemo(() => {
    // Check for failed MCP servers first - show yellow warning
    if (!isRemoteMode && columns > 60 && services.mcp?.mcpService) {
      const state = services.mcp.mcpService.getState();
      const failedServers = state.connections.filter(
        (connection) => connection.status === "error",
      );

      if (failedServers.length > 0) {
        return "yellow";
      }
    }

    // Fallback to update status colors
    switch (services.update?.status) {
      case UpdateStatus.UPDATING:
      case UpdateStatus.CHECKING:
        return "yellow";
      case UpdateStatus.UPDATED:
        return "green";
      case UpdateStatus.ERROR:
        return "red";
      default:
        return "dim";
    }
  }, [
    services.update?.status,
    services.mcp?.mcpService,
    columns,
    isRemoteMode,
  ]);

  const text = useMemo(() => {
    // Check for failed MCP servers first - only show on wide screens (>60 columns)
    if (!isRemoteMode && columns > 60 && services.mcp?.mcpService) {
      const state = services.mcp.mcpService.getState();
      const failedServers = state.connections.filter(
        (connection) => connection.status === "error",
      );

      if (failedServers.length > 0) {
        const message =
          failedServers.length === 1
            ? `${failedServers[0].config?.name || "MCP server"} failed to start, /mcp to configure`
            : `${failedServers.length} MCP servers failed to start, /mcp to configure`;
        return message;
      }
    }

    // Fallback to update message or default "Continue CLI"
    if (!services.update?.message) {
      return "Continue CLI";
    }

    return services.update.message;
  }, [
    columns,
    services.update?.message,
    services.mcp?.mcpService,
    isRemoteMode,
  ]);

  if (!services.update?.isUpdateAvailable && isRemoteMode) {
    return <Text color="cyan">◉ Remote Mode</Text>;
  }

  return <Text color={color}>{`◉ ${text}`}</Text>;
};

export { UpdateNotification };
