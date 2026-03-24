import * as fs from "fs";
import * as path from "path";

import React, { useEffect, useState } from "react";

import { env } from "../env.js";
import { services } from "../services/index.js";

import { Selector, SelectorOption } from "./Selector.js";

interface ConfigOption extends SelectorOption {
  type: "local" | "assistant" | "create";
  slug?: string;
  organizationId?: string | null;
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
        const options: ConfigOption[] = [];

        // Add local config.yaml if it exists
        if (fs.existsSync(CONFIG_PATH)) {
          options.push({
            id: "local",
            name: "Local config.yaml",
            type: "local",
            organizationId: null,
          });
        }

        // Determine current config
        const currentConfigState = services.config.getState();
        let currentId: string | null = null;

        if (
          currentConfigState.configPath === CONFIG_PATH &&
          fs.existsSync(CONFIG_PATH)
        ) {
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
