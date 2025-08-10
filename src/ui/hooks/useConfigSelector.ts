import { exec } from "child_process";
import * as path from "path";

import { env } from "../../env.js";
import { services } from "../../services/index.js";
import { useNavigation } from "../context/NavigationContext.js";

interface ConfigOption {
  id: string;
  name: string;
  type: "local" | "assistant" | "create";
  slug?: string;
}

interface UseConfigSelectorProps {
  configPath?: string;
  onMessage: (message: {
    role: string;
    content: string;
    messageType: "system";
  }) => void;
  onChatReset: () => void;
}

const CONFIG_PATH = path.join(env.continueHome, "config.yaml");

export function useConfigSelector({
  onMessage,
  onChatReset,
}: UseConfigSelectorProps) {
  const { closeCurrentScreen } = useNavigation();

  const handleConfigSelect = async (config: ConfigOption) => {
    closeCurrentScreen();

    if (config.type === "create") {
      // Open the web browser to create new assistant
      const url = new URL("https://hub.continue.dev/new");
      url.searchParams.set("type", "assistant");

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
      } catch {
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

      let targetConfigPath: string | undefined;

      if (config.type === "local") {
        targetConfigPath = CONFIG_PATH;
      } else if (config.type === "assistant" && config.slug) {
        targetConfigPath = config.slug;
      }

      // Use the ConfigService's reactive updateConfigPath method
      // This will automatically update state and trigger dependent service reloads
      await services.config.updateConfigPath(targetConfigPath);

      // Reset chat history
      onChatReset();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

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

  return {
    handleConfigSelect,
  };
}
