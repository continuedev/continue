import { AssistantUnrolled } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { useState } from "react";
import { exec } from "child_process";
import { loadAuthConfig, updateAssistantSlug } from "../../auth/workos.js";
import { initialize } from "../../config.js";
import { introMessage } from "../../intro.js";
import { MCPService } from "../../mcp.js";
import * as path from "path";
import * as os from "os";

interface ConfigOption {
  id: string;
  name: string;
  type: "local" | "assistant" | "create";
  slug?: string;
}

interface UseConfigSelectorProps {
  configPath?: string;
  onAssistantChange: (
    assistant: AssistantUnrolled,
    model: string,
    llmApi: BaseLlmApi,
    mcpService: MCPService
  ) => void;
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  onChatReset: () => void;
}

const CONFIG_PATH = path.join(os.homedir(), ".continue", "config.yaml");

export function useConfigSelector({
  configPath,
  onAssistantChange,
  onMessage,
  onChatReset,
}: UseConfigSelectorProps) {
  const [showConfigSelector, setShowConfigSelector] = useState(false);

  const handleConfigSelect = async (config: ConfigOption) => {
    setShowConfigSelector(false);

    if (config.type === "create") {
      // Open the web browser to create new assistant
      const url = "https://hub.continue.dev/new?type=assistant";
      
      try {
        let command: string;
        if (process.platform === "darwin") {
          command = `open "${url}"`;
        } else if (process.platform === "win32") {
          command = `start "${url}"`;
        } else {
          command = `xdg-open "${url}"`;
        }
        
        exec(command, (error) => {
          if (error) {
            console.error("Failed to open browser:", error);
          }
        });
        
        onMessage({
          role: "system",
          content: `Opening ${url} in your browser to create a new assistant...`,
          messageType: "system" as const,
        });
      } catch (error) {
        onMessage({
          role: "system",
          content: `Please visit ${url} to create a new assistant`,
          messageType: "system" as const,
        });
      }
      return;
    }

    try {
      // Show loading message
      onMessage({
        role: "system",
        content: `Switching to configuration: ${config.name}...`,
        messageType: "system" as const,
      });

      const authConfig = loadAuthConfig();
      let targetConfigPath: string | undefined;

      if (config.type === "local") {
        targetConfigPath = CONFIG_PATH;
        // Clear assistant slug when switching to local config
        updateAssistantSlug(null);
      } else if (config.type === "assistant" && config.slug) {
        // Use the slug to load the assistant
        targetConfigPath = config.slug;
        // Save the assistant slug to auth config
        updateAssistantSlug(config.slug);
      }

      // Reinitialize with the selected configuration
      const {
        config: newConfig,
        llmApi: newLlmApi,
        model: newModel,
        mcpService: newMcpService,
      } = await initialize(authConfig, targetConfigPath);

      // Update assistant configuration
      onAssistantChange(newConfig, newModel, newLlmApi, newMcpService);

      // Reset chat history
      onChatReset();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

      // Show the new intro message
      introMessage(newConfig, newModel, newMcpService);

      // Show success message
      onMessage({
        role: "system",
        content: `Successfully switched to configuration: ${config.name}`,
        messageType: "system" as const,
      });
    } catch (error: any) {
      // Show error message
      onMessage({
        role: "system",
        content: `Failed to switch configuration: ${error.message}`,
        messageType: "system" as const,
      });
    }
  };

  const handleConfigCancel = () => {
    setShowConfigSelector(false);
  };

  const showConfigSelectorUI = () => {
    setShowConfigSelector(true);
  };

  return {
    showConfigSelector,
    handleConfigSelect,
    handleConfigCancel,
    showConfigSelectorUI,
  };
}