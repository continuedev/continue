import { AssistantUnrolled } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { useState } from "react";
import { loadAuthConfig, saveAuthConfig } from "../../auth/workos.js";
import { initializeAssistant } from "../../config.js";
import { introMessage } from "../../intro.js";
import { MCPService } from "../../mcp.js";

interface UseOrganizationSelectorProps {
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

export function useOrganizationSelector({
  configPath,
  onAssistantChange,
  onMessage,
  onChatReset,
}: UseOrganizationSelectorProps) {
  const [showOrgSelector, setShowOrgSelector] = useState(false);

  const handleOrganizationSelect = async (
    organizationId: string | null,
    organizationName: string
  ) => {
    setShowOrgSelector(false);

    // Update auth config
    const authConfig = loadAuthConfig();
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
      } = await initializeAssistant(updatedConfig, configPath);

      // Update assistant configuration
      onAssistantChange(config, newModel, newLlmApi, newMcpService);

      // Reset chat history
      onChatReset();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

      // Show the new intro message
      introMessage(config, newModel, newMcpService);

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

  const handleOrganizationCancel = () => {
    setShowOrgSelector(false);
  };

  const showOrganizationSelector = () => {
    setShowOrgSelector(true);
  };

  return {
    showOrgSelector,
    handleOrganizationSelect,
    handleOrganizationCancel,
    showOrganizationSelector,
  };
}
