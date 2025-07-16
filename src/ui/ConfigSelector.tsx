import {
  Configuration,
  DefaultApi,
} from "@continuedev/sdk/dist/api/dist/index.js";
import * as fs from "fs";
import { Box, Text, useInput } from "ink";
import * as os from "os";
import * as path from "path";
import React, { useEffect, useState } from "react";
import {
  getAccessToken,
  getOrganizationId,
  loadAuthConfig,
} from "../auth/workos.js";

interface ConfigOption {
  id: string;
  name: string;
  type: "local" | "assistant" | "create";
  slug?: string;
}

interface ConfigSelectorProps {
  onSelect: (config: ConfigOption) => void;
  onCancel: () => void;
}

const CONFIG_PATH = path.join(os.homedir(), ".continue", "config.yaml");

const ConfigSelector: React.FC<ConfigSelectorProps> = ({
  onSelect,
  onCancel,
}) => {
  const [configs, setConfigs] = useState<ConfigOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const authConfig = loadAuthConfig();
        const accessToken = getAccessToken(authConfig);
        const organizationId = getOrganizationId(authConfig);

        const options: ConfigOption[] = [];

        // Add local config.yaml if it exists
        if (fs.existsSync(CONFIG_PATH)) {
          options.push({
            id: "local",
            name: "Local config.yaml",
            type: "local",
          });
        }

        // Add assistants from current organization if authenticated
        if (accessToken) {
          const apiClient = new DefaultApi(
            new Configuration({
              accessToken,
            })
          );

          try {
            const assistants = await apiClient.listAssistants({
              alwaysUseProxy: "false",
              organizationId: organizationId ?? undefined,
            });

            for (const assistant of assistants) {
              // Use packageSlug as the slug and create a display name from ownerSlug/packageSlug
              const displayName = `${assistant.ownerSlug}/${assistant.packageSlug}`;
              options.push({
                id: assistant.packageSlug,
                name: displayName,
                type: "assistant",
                slug: assistant.packageSlug,
              });
            }
          } catch (err) {
            console.error("Failed to load assistants:", err);
          }
        }

        // Add "Create new assistant" option
        options.push({
          id: "create",
          name: "Create new assistant",
          type: "create",
        });

        setConfigs(options);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load configurations");
        setLoading(false);
      }
    };

    loadConfigs();
  }, []);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      const selectedConfig = configs[selectedIndex];
      if (selectedConfig) {
        onSelect(selectedConfig);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(configs.length - 1, prev + 1));
    }
  });

  if (loading) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="blue"
      >
        <Text color="blue" bold>
          Configuration Selector
        </Text>
        <Text color="gray">Loading configurations...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="red"
      >
        <Text color="red" bold>
          Error
        </Text>
        <Text color="red">{error}</Text>
        <Text color="gray" dimColor>
          Press Escape to cancel
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="blue"
    >
      <Text color="blue" bold>
        Select Configuration
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {configs.map((config, index) => {
          const isSelected = index === selectedIndex;

          return (
            <Box key={config.id}>
              <Text
                color={isSelected ? "blue" : "white"}
                bold={isSelected}
                inverse={isSelected}
              >
                {isSelected ? "▶ " : "  "}
                {config.name}
                {config.type === "local" ? " (local)" : ""}
                {config.type === "create" ? " (opens web)" : ""}
                {isSelected ? " (current)" : ""}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use ↑/↓ to navigate, Enter to select, Escape to cancel
        </Text>
      </Box>
    </Box>
  );
};

export default ConfigSelector;
