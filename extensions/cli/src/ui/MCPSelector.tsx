import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { quote } from "shell-quote";

import { useServices } from "../hooks/useService.js";
import {
  MCPConnectionInfo,
  MCPServerStatus,
  MCPServiceState,
  SERVICE_NAMES,
} from "../services/types.js";
import { logger } from "../util/logger.js";

import { defaultBoxStyles } from "./styles.js";

// Utility function to get status icon and color based on server connection
const getServerStatusDisplay = (conn: MCPConnectionInfo) => {
  let icon = "⚪️"; // note, white circle causes extra blank line bug
  let color: "green" | "yellow" | "red" | "white" | "dim" = "white";
  let statusText = conn.status;

  if (conn.status === "connecting") {
    icon = "🟡";
    color = "yellow";
  } else if (conn.status === "error") {
    icon = "🔴";
    color = "red";
  } else if (conn.status === "connected") {
    if (conn.warnings && conn.warnings.length > 0) {
      icon = "🟡";
      color = "yellow";
      statusText = "connected (with warnings)" as MCPServerStatus;
    } else {
      icon = "🟢";
      color = "green";
    }
  }

  return { icon, color, statusText };
};

interface MCPSelectorProps {
  onCancel: () => void;
}

type MCPMenuState = "main" | "server-detail";

interface MCPMenuItem {
  label: string;
  value: string;
}

export const MCPSelector: React.FC<MCPSelectorProps> = ({ onCancel }) => {
  const [menuState, setMenuState] = useState<MCPMenuState>("main");
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { services } = useServices<{ mcp: MCPServiceState }>([
    SERVICE_NAMES.MCP,
  ]);
  const connections = services.mcp?.connections ?? [];
  const mcpService = services.mcp?.mcpService;

  const backItem = { label: "Back", value: "back" };

  const handleBack = () => {
    if (menuState === "server-detail") {
      setSelectedServer(null);
      setMenuState("main");
      setSelectedIndex(0);
    } else {
      onCancel();
    }
    setMessage(null);
  };

  // Main menu items (includes servers)
  const getMainMenuItems = (): MCPMenuItem[] => {
    const options: MCPMenuItem[] = [];

    // Add individual servers first
    if (connections.length > 0) {
      connections.forEach((conn) => {
        const { icon } = getServerStatusDisplay(conn);

        let serverLabel = `${icon} ${conn.config.name}`;

        // Add tools and prompts count if server is connected
        if (conn.status === "connected") {
          const toolsCount = conn.tools.length;
          const promptsCount = conn.prompts.length;

          const counts = [];
          if (toolsCount > 0) {
            counts.push(`🔧${toolsCount}`);
          }
          if (promptsCount > 0) {
            counts.push(`📝${promptsCount}`);
          }

          if (counts.length > 0) {
            serverLabel += ` (${counts.join(" ")})`;
          }
        }

        options.push({
          label: serverLabel,
          value: `server:${conn.config.name}`,
        });
      });

      // Add bulk actions
      options.push(
        { label: "🔄 Restart all servers", value: "restart-all" },
        { label: "⏹️  Stop all servers", value: "stop-all" },
      );
    }

    // Add "Explore MCP Servers" option at the bottom
    options.push({
      label: "🔍 Explore MCP Servers",
      value: "explore-mcp-servers",
    });

    return options;
  };

  // Server detail items
  const getServerDetailItems = (): MCPMenuItem[] => {
    if (!selectedServer) return [];

    const serverInfo = connections.find(
      (conn) => conn.config.name === selectedServer,
    );
    if (!serverInfo) return [];

    const items: MCPMenuItem[] = [
      { label: "🔄 Restart server", value: "restart" },
    ];

    // Only show stop server if it's connected
    if (serverInfo.status === "connected") {
      items.push({ label: "⏹️  Stop server", value: "stop" });
    }

    return items;
  };
  const getServerInfoDisplay = () => {
    if (menuState !== "server-detail" || !selectedServer) return null;

    const serverInfo = connections.find(
      (conn) => conn.config.name === selectedServer,
    );
    if (!serverInfo) return null;

    return (
      <Box flexDirection="column">
        {/* Add error if server has error status */}
        {serverInfo.status === "error" && serverInfo.error && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="red" bold>
              🚫 Error:
            </Text>
            <Text color="red">{serverInfo.error}</Text>
          </Box>
        )}

        {/* Add warnings if any */}
        {serverInfo.warnings.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="yellow" bold>
              ⚠️ Warnings:
            </Text>
            {serverInfo.warnings.map((warning, index) => (
              <Text key={index} color="yellow">
                • {warning}
              </Text>
            ))}
          </Box>
        )}

        {/* Add prompts if any */}
        {serverInfo.prompts.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="blue">📝 Prompts: {serverInfo.prompts.length}</Text>
            {serverInfo.prompts.map((prompt, index) => (
              <Text key={index} color="dim">
                • {prompt.name}
              </Text>
            ))}
          </Box>
        )}

        {/* Add tools if any */}
        {serverInfo.tools.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            <Text color="blue">🔧 Tools: {serverInfo.tools.length}</Text>
            {serverInfo.tools.map((tool, index) => (
              <Text key={index} color="dim">
                • {tool.name}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  let items: MCPMenuItem[] = [];

  switch (menuState) {
    case "main":
      items = getMainMenuItems();
      break;
    case "server-detail":
      items = getServerDetailItems();
      break;
  }

  items = [...items, backItem];

  const maxIndex = Math.max(0, items.length - 1);

  useInput(async (input, key) => {
    // Always allow escape/Ctrl+C so users can cancel even when loading
    if (key.escape || (key.ctrl && input === "c")) {
      handleBack();
      return;
    }

    if (isLoading) return;

    if (key.upArrow) {
      setSelectedIndex(selectedIndex <= 0 ? maxIndex : selectedIndex - 1);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
      return;
    }

    if (key.return) {
      const selectedItem = items[selectedIndex];
      if (!selectedItem) return;

      setIsLoading(true);
      setMessage(null);

      try {
        switch (menuState) {
          case "main":
            await handleMainMenuSelect(selectedItem.value);
            break;
          case "server-detail":
            await handleServerAction(selectedItem.value);
            break;
        }
      } catch (error: any) {
        setMessage(`Error: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  });

  const handleMainMenuSelect = async (value: string) => {
    if (value.startsWith("server:")) {
      // Handle server selection
      const serverName = value.replace("server:", "");
      setSelectedServer(serverName);
      setMenuState("server-detail");
      setSelectedIndex(0);
      return;
    }

    switch (value) {
      case "restart-all":
        await mcpService?.restartAllServers();
        setMessage("All servers restarted");
        break;
      case "stop-all":
        await mcpService?.shutdownConnections();
        setMessage("All servers stopped");
        break;
      case "explore-mcp-servers":
        // Open the MCP servers hub in the default browser
        const open = (await import("open")).default;
        await open("https://yutoagentic.dev/hub?type=mcpServers");
        setMessage("Opened MCP servers hub in browser");
        break;
      case "back":
        onCancel();
        return;
    }
  };

  const handleServerAction = async (action: string) => {
    try {
      switch (action) {
        case "restart":
          if (!selectedServer) {
            return;
          }
          await mcpService?.restartServer(selectedServer);
          setMessage(`Server "${selectedServer}" restarted`);
          break;
        case "stop":
          if (!selectedServer) {
            return;
          }
          await mcpService?.stopServer(selectedServer);
          setMessage(`Server "${selectedServer}" stopped`);
          break;
        case "back":
          handleBack();
          return;
      }
    } catch {
      logger.error("Error handling MCP action");
    }
  };

  const renderHeader = () => {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="blue">
          {menuState === "server-detail" && selectedServer
            ? `Server: ${selectedServer}`
            : "MCP Servers"}
        </Text>
        {connections.length === 0 && (
          <Text color="gray">No servers configured</Text>
        )}
        {menuState === "server-detail" &&
          selectedServer &&
          (() => {
            const serverInfo = connections.find(
              (conn) => conn.config.name === selectedServer,
            );
            if (!serverInfo) return null;

            const { color: statusColor, statusText } =
              getServerStatusDisplay(serverInfo);

            let configText = "";
            if ("command" in serverInfo.config) {
              const { command, args } = serverInfo.config;
              const cmd = command ? quote([command, ...(args ?? [])]) : "";
              if (cmd) {
                configText = ` • Command: ${cmd}`;
              }
            } else {
              const { url } = serverInfo.config;
              configText = ` • URL: ${url}`;
            }
            configText = configText.replace(/\$\{\{.*\}\}/, "(secret)");

            return (
              <Text color="dim">
                Status: <Text color={statusColor}>{statusText}</Text>
                {configText}
              </Text>
            );
          })()}
      </Box>
    );
  };

  return (
    <Box {...defaultBoxStyles("blue", { minHeight: 10 })}>
      {renderHeader()}

      {message && (
        <Box marginBottom={1}>
          <Text color={message.startsWith("Error:") ? "red" : "green"}>
            {message}
          </Text>
        </Box>
      )}

      {menuState === "server-detail" && getServerInfoDisplay()}

      {isLoading ? (
        <Box>
          <Text color="yellow">Working...</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;

            return (
              <Text
                key={`${item.value}-${index}`}
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
              >
                {isSelected ? "➤ " : "  "}
                {item.label}
              </Text>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="dim">
          ↑/↓ to navigate, Enter to select, Esc to go back
        </Text>
      </Box>
    </Box>
  );
};
