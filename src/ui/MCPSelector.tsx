import { Box, Text, useInput } from "ink";
import React, { useState } from "react";
import { useServices } from "../hooks/useService.js";
import { MCPServiceState } from "../services/types.js";

interface MCPSelectorProps {
  onCancel: () => void;
}

type MCPMenuState = "main" | "servers" | "server-detail";

interface MCPMenuItem {
  label: string;
  value: string;
  disabled?: boolean;
}

const MCPSelector: React.FC<MCPSelectorProps> = ({ onCancel }) => {
  const [menuState, setMenuState] = useState<MCPMenuState>("main");
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { services } = useServices<{ mcp: MCPServiceState }>(["mcp"]);
  const mcpService = services.mcp?.mcpService;

  const handleBack = () => {
    if (menuState === "server-detail") {
      setSelectedServer(null);
      setMenuState("servers");
    } else if (menuState === "servers") {
      setMenuState("main");
    } else {
      onCancel();
    }
    setSelectedIndex(0);
    setMessage(null);
  };

  // Main menu items
  const getMainMenuItems = (): MCPMenuItem[] => {
    const connections = services.mcp?.connections || [];

    if (connections.length === 0) {
      return [
        { label: "No servers configured", value: "no-servers", disabled: true },
        { label: "← Back", value: "back" },
      ];
    }

    return [
      { label: "🔄 Restart all servers", value: "restart-all" },
      { label: "⏹️  Stop all servers", value: "stop-all" },
      { label: "👁️  View servers", value: "view-servers" },
      { label: "← Back", value: "back" },
    ];
  };

  // Server list items
  const getServerItems = (): MCPMenuItem[] => {
    const connections = services.mcp?.connections || [];

    if (connections.length === 0) {
      return [
        { label: "No servers", value: "no-servers", disabled: true },
        { label: "← Back", value: "back" },
      ];
    }

    const serverItems = connections.map((conn) => {
      let statusIcon = "⚪"; // idle
      if (conn.status === "connecting") statusIcon = "🟡";
      else if (conn.status === "error") statusIcon = "🔴";
      else if (conn.status === "connected") {
        statusIcon = conn.warnings.length > 0 ? "🟡" : "🟢";
      }

      return {
        label: `${statusIcon} ${conn.name}`,
        value: conn.name,
      };
    });

    return [...serverItems, { label: "← Back", value: "back" }];
  };

  // Server detail items
  const getServerDetailItems = (): MCPMenuItem[] => {
    if (!selectedServer) return [];

    const serverInfo = mcpService?.getServerInfo(selectedServer);
    if (!serverInfo) return [];

    const items: MCPMenuItem[] = [
      { label: "🔄 Restart server", value: "restart" },
      { label: "⏹️  Stop server", value: "stop" },
    ];

    // Add warnings if any
    if (serverInfo.warnings.length > 0) {
      items.push({ label: "", value: "spacer", disabled: true });
      items.push({
        label: "⚠️  Warnings:",
        value: "warnings-header",
        disabled: true,
      });
      serverInfo.warnings.forEach((warning, index) => {
        items.push({
          label: `   ${warning}`,
          value: `warning-${index}`,
          disabled: true,
        });
      });
    }

    // Add prompts if any
    if (serverInfo.promptCount > 0) {
      items.push({ label: "", value: "spacer2", disabled: true });
      items.push({
        label: `📝 Prompts (${serverInfo.promptCount}):`,
        value: "prompts-header",
        disabled: true,
      });
    }

    // Add tools if any
    if (serverInfo.toolCount > 0) {
      items.push({ label: "", value: "spacer3", disabled: true });
      items.push({
        label: `🔧 Tools (${serverInfo.toolCount}):`,
        value: "tools-header",
        disabled: true,
      });
    }

    items.push({ label: "", value: "spacer4", disabled: true });
    items.push({ label: "← Back", value: "back" });

    return items;
  };

  let items: MCPMenuItem[] = [];

  switch (menuState) {
    case "main":
      items = getMainMenuItems();
      break;
    case "servers":
      items = getServerItems();
      break;
    case "server-detail":
      items = getServerDetailItems();
      break;
  }

  // Filter out disabled items for navigation
  const navigableItems = items.filter((item) => !item.disabled);
  const maxIndex = Math.max(0, navigableItems.length - 1);

  useInput(async (input, key) => {
    if (isLoading) return;

    if (key.escape) {
      handleBack();
      return;
    }

    if (key.upArrow) {
      const currentNavigableIndex = navigableItems.findIndex(
        (item) => item === items[selectedIndex]
      );
      const newNavigableIndex = Math.max(0, currentNavigableIndex - 1);
      const newIndex = items.findIndex(
        (item) => item === navigableItems[newNavigableIndex]
      );
      setSelectedIndex(newIndex);
      return;
    }

    if (key.downArrow) {
      const currentNavigableIndex = navigableItems.findIndex(
        (item) => item === items[selectedIndex]
      );
      const newNavigableIndex = Math.min(maxIndex, currentNavigableIndex + 1);
      const newIndex = items.findIndex(
        (item) => item === navigableItems[newNavigableIndex]
      );
      setSelectedIndex(newIndex);
      return;
    }

    if (key.return) {
      const selectedItem = items[selectedIndex];
      if (!selectedItem || selectedItem.disabled) return;

      setIsLoading(true);
      setMessage(null);

      try {
        switch (menuState) {
          case "main":
            await handleMainMenuSelect(selectedItem.value);
            break;
          case "servers":
            handleServerSelect(selectedItem.value);
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
    if (!mcpService) return;

    switch (value) {
      case "restart-all":
        await mcpService.restartAllServers();
        setMessage("All servers restarted successfully");
        break;
      case "stop-all":
        await mcpService.stopAllServers();
        setMessage("All servers stopped");
        break;
      case "view-servers":
        setMenuState("servers");
        setSelectedIndex(0);
        break;
      case "back":
        onCancel();
        return;
    }
  };

  const handleServerSelect = (value: string) => {
    if (value === "back") {
      handleBack();
    } else if (value !== "no-servers") {
      setSelectedServer(value);
      setMenuState("server-detail");
      setSelectedIndex(0);
    }
  };

  const handleServerAction = async (action: string) => {
    if (!mcpService || !selectedServer) return;

    switch (action) {
      case "restart":
        await mcpService.restartServer(selectedServer);
        setMessage(`Server "${selectedServer}" restarted successfully`);
        break;
      case "stop":
        await mcpService.stopServer(selectedServer);
        setMessage(`Server "${selectedServer}" stopped`);
        break;
      case "back":
        handleBack();
        return;
    }
  };

  const renderHeader = () => {
    let title = "MCP Management";
    let subtitle = "";

    if (menuState === "servers") {
      title = "MCP Servers";
    } else if (menuState === "server-detail" && selectedServer) {
      const serverInfo = mcpService?.getServerInfo(selectedServer);
      title = `Server: ${selectedServer}`;
      if (serverInfo) {
        let statusText = serverInfo.status;
        if (
          serverInfo.status === "connected" &&
          serverInfo.warnings.length > 0
        ) {
          statusText += " (with warnings)";
        }
        subtitle = `Status: ${statusText} • Command: ${serverInfo.command}`;
      }
    }

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        {subtitle && <Text color="dim">{subtitle}</Text>}
      </Box>
    );
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      minHeight={10}
    >
      {renderHeader()}

      {message && (
        <Box marginBottom={1}>
          <Text color={message.startsWith("Error:") ? "red" : "green"}>
            {message}
          </Text>
        </Box>
      )}

      {isLoading ? (
        <Box>
          <Text color="yellow">Working...</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex && !item.disabled;
            const canSelect = !item.disabled;

            return (
              <Box key={`${item.value}-${index}`}>
                <Text
                  color={item.disabled ? "dim" : isSelected ? "blue" : "white"}
                  bold={isSelected}
                  inverse={isSelected}
                >
                  {isSelected && canSelect ? "> " : "  "}
                  {item.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="dim">
          Use ↑/↓ to navigate, Enter to select, Esc to go back
        </Text>
      </Box>
    </Box>
  );
};

export default MCPSelector;
