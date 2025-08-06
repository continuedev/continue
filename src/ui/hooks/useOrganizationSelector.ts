import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { useState } from "react";

import {
  isAuthenticatedConfig,
  loadAuthConfig,
  saveAuthConfig,
} from "../../auth/workos.js";
import { initialize } from "../../config.js";
import { MCPService } from "../../mcp.js";

interface UseOrganizationSelectorProps {
  configPath?: string;
  onAssistantChange: (
    assistant: AssistantUnrolled,
    model: ModelConfig,
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

export function useOrganizationSelector({
  configPath,
  onAssistantChange,
  onMessage,
  onChatReset,
}: UseOrganizationSelectorProps) {

  const handleOrganizationSelect = async (
    organizationId: string | null,
    organizationName: string
  ) => {

    // Update auth config
    const authConfig = loadAuthConfig();

    // Only allow organization switching for authenticated users
    if (!isAuthenticatedConfig(authConfig)) {
      onMessage({
        role: "system",
        content:
          "Organization switching not available for environment variable auth",
        messageType: "system" as const,
      });
      return;
    }

    const updatedConfig = {
      ...authConfig,
      organizationId,
    };
    saveAuthConfig(updatedConfig);

    try {
      // Show loading message
      onMessage({
        role: "system",
        content: `Switching to organization: ${organizationName}...`,
        messageType: "system" as const,
      });

      // Reinitialize assistant with new organization
      const {
        config,
        llmApi: newLlmApi,
        model: newModel,
        mcpService: newMcpService,
      } = await initialize(updatedConfig, configPath);

      // Update assistant configuration
      onAssistantChange(config, newModel, newLlmApi, newMcpService);

      // Reset chat history
      onChatReset();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

      // Show success message
      onMessage({
        role: "system",
        content: `Successfully switched to organization: ${organizationName}`,
        messageType: "system" as const,
      });
    } catch (error: any) {
      // Show error message
      onMessage({
        role: "system",
        content: `Failed to switch organization: ${error.message}`,
        messageType: "system" as const,
      });
    }
  };

  return {
    handleOrganizationSelect,
  };
}
