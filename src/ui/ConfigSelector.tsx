import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import React, { useEffect, useState } from "react";
import {
  getAccessToken,
  getOrganizationId,
  loadAuthConfig,
  getAssistantSlug,
} from "../auth/workos.js";
import { getApiClient } from "../config.js";
import Selector, { SelectorOption } from "./Selector.js";

interface ConfigOption extends SelectorOption {
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
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const authConfig = loadAuthConfig();
        const accessToken = getAccessToken(authConfig);
        const organizationId = getOrganizationId(authConfig);

        const options: ConfigOption[] = [];
        let currentId: string | null = null;

        // Add local config.yaml if it exists
        if (fs.existsSync(CONFIG_PATH)) {
          options.push({
            id: "local",
            name: "Local config.yaml",
            type: "local",
            displaySuffix: " (local)",
          });
        }

        // Add assistants from current organization if authenticated
        if (accessToken) {
          const apiClient = getApiClient(accessToken);

          try {
            const assistants = await apiClient.listAssistants({
              alwaysUseProxy: "false",
              organizationId: organizationId ?? undefined,
            });

            for (const assistant of assistants) {
              // Use full ownerSlug/packageSlug as the slug and create a display name from ownerSlug/packageSlug
              const displayName = `${assistant.ownerSlug}/${assistant.packageSlug}`;
              options.push({
                id: assistant.packageSlug,
                name: displayName,
                type: "assistant",
                slug: `${assistant.ownerSlug}/${assistant.packageSlug}`,
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
          displaySuffix: " (opens web)",
        });

        // Determine current config by checking auth config
        const assistantSlug = getAssistantSlug(authConfig);
        if (assistantSlug) {
          // Extract packageSlug from the full slug for matching
          currentId = assistantSlug.split("/")[1];
        } else if (fs.existsSync(CONFIG_PATH)) {
          // No assistant slug means local config is current
          currentId = "local";
        }

        setConfigs(options);
        setCurrentConfigId(currentId);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Failed to load configurations");
        setLoading(false);
      }
    };

    loadConfigs();
  }, []);

  return (
    <Selector
      title="Select Configuration"
      options={configs}
      selectedIndex={selectedIndex}
      loading={loading}
      error={error}
      loadingMessage="Loading configurations..."
      currentId={currentConfigId}
      onSelect={onSelect}
      onCancel={onCancel}
      onNavigate={setSelectedIndex}
    />
  );
};

export default ConfigSelector;
