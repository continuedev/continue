import * as fs from "fs";
import * as path from "path";

import React, { useEffect, useState } from "react";

import {
  getAccessToken,
  getAssistantSlug,
  getOrganizationId,
  listUserOrganizations,
  loadAuthConfig,
} from "../auth/workos.js";
import { getApiClient } from "../config.js";
import { env } from "../env.js";
import { services } from "../services/index.js";

import { Selector, SelectorOption } from "./Selector.js";

interface ConfigOption extends SelectorOption {
  type: "local" | "assistant" | "create";
  slug?: string;
  organizationId?: string | null; // null for personal, string for org
}

interface ConfigSelectorProps {
  onSelect: (config: ConfigOption) => void;
  onCancel: () => void;
}

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

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
        const currentOrganizationId = getOrganizationId(authConfig);

        const options: ConfigOption[] = [];
        let currentId: string | null = null;

        // Add local config.yaml if it exists
        if (fs.existsSync(CONFIG_PATH)) {
          options.push({
            id: "local",
            name: "[Personal] Local config.yaml",
            type: "local",
            organizationId: null,
          });
        }

        // Add assistants from all organizations if authenticated
        if (accessToken) {
          const apiClient = getApiClient(accessToken);

          try {
            // Get all organizations
            const organizations = await listUserOrganizations();
            const allOrgs = [
              { id: null, name: "Personal" }, // Personal organization
              ...(organizations || []),
            ];

            // Fetch assistants for each organization
            const assistantPromises = allOrgs.map(async (org) => {
              try {
                const assistants = await apiClient.listAssistants({
                  alwaysUseProxy: "false",
                  organizationId: org.id ?? undefined,
                });

                return assistants.map((assistant) => {
                  const name =
                    (assistant.configResult.config as any)?.name ??
                    `${assistant.ownerSlug}/${assistant.packageSlug}`;
                  const displayName = `[${org.name}] ${name}`;
                  // Create unique ID that includes org info to avoid conflicts
                  const uniqueId = `${org.id || "personal"}-${assistant.packageSlug}`;
                  return {
                    id: uniqueId,
                    name: displayName,
                    type: "assistant" as const,
                    slug: `${assistant.ownerSlug}/${assistant.packageSlug}`,
                    organizationId: org.id,
                  };
                });
              } catch (err) {
                console.error(
                  `Failed to load assistants for org ${org.name}:`,
                  err,
                );
                return [];
              }
            });

            const assistantResults = await Promise.all(assistantPromises);
            const allAssistants = assistantResults.flat();
            options.push(...allAssistants);
          } catch (err) {
            console.error("Failed to load organizations or assistants:", err);
          }
        }

        // Add "Create new assistant" option
        options.push({
          id: "create",
          name: "Create new assistant",
          type: "create",
          displaySuffix: " (opens web)",
        });

        // Determine current config by checking both auth config and service state
        const assistantSlug = getAssistantSlug(authConfig);
        const currentConfigState = services.config.getState();

        if (assistantSlug) {
          // Find the matching config by slug and organization
          const matchingConfig = options.find(
            (opt) =>
              opt.type === "assistant" &&
              opt.slug === assistantSlug &&
              opt.organizationId === currentOrganizationId,
          );
          currentId = matchingConfig?.id || null;
        } else if (
          currentConfigState.configPath === CONFIG_PATH &&
          fs.existsSync(CONFIG_PATH)
        ) {
          // Only mark local config as current if it's actually the active config path in the service
          // This ensures we don't show a green checkmark for first-time users just because the file exists
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

export { ConfigSelector };
