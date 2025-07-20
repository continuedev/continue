import { AssistantUnrolled, ModelConfig } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { Box, Text } from "ink";
import React, { useState } from "react";
import { loadAuthConfig } from "../auth/workos.js";
import { initialize } from "../config.js";
import { introMessage } from "../intro.js";
import { MCPService } from "../mcp.js";
import ConfigSelector from "./ConfigSelector.js";
import { useChat } from "./hooks/useChat.js";
import { useConfigSelector } from "./hooks/useConfigSelector.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import { useOrganizationSelector } from "./hooks/useOrganizationSelector.js";
import LoadingAnimation from "./LoadingAnimation.js";
import OrganizationSelector from "./OrganizationSelector.js";
import Timer from "./Timer.js";
import UserInput from "./UserInput.js";

interface TUIChatProps {
  config: AssistantUnrolled;
  model: ModelConfig;
  llmApi: BaseLlmApi;
  mcpService: MCPService;
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
}

const TUIChat: React.FC<TUIChatProps> = ({
  config: initialAssistant,
  model: initialModel,
  llmApi: initialLlmApi,
  mcpService: initialMcpService,
  configPath,
  initialPrompt,
  resume,
  additionalRules,
}) => {
  // Track current assistant configuration state
  const [assistant, setAssistant] = useState(initialAssistant);
  const [model, setModel] = useState(initialModel);
  const [llmApi, setLlmApi] = useState(initialLlmApi);
  const [mcpService, setMcpService] = useState(initialMcpService);

  // State for login prompt handling
  const [loginPrompt, setLoginPrompt] = useState<{
    text: string;
    resolve: (value: string) => void;
  } | null>(null);
  const [loginToken, setLoginToken] = useState("");

  // Custom login prompt handler for TUI
  const handleLoginPrompt = (promptText: string): Promise<string> => {
    return new Promise((resolve) => {
      setLoginPrompt({ text: promptText, resolve });
    });
  };

  // Handle login token submission
  const handleLoginTokenSubmit = (token: string) => {
    if (loginPrompt) {
      setLoginToken("");
      loginPrompt.resolve(token);
      setLoginPrompt(null);
    }
  };

  // Reload function for after login
  const handleReload = async () => {
    try {
      // Reload auth config and reinitialize
      const authConfig = loadAuthConfig();
      const {
        config: newAssistant,
        llmApi: newLlmApi,
        model: newModel,
        mcpService: newMcpService,
      } = await initialize(authConfig, configPath);

      // Update all the state
      setAssistant(newAssistant);
      setModel(newModel);
      setLlmApi(newLlmApi);
      setMcpService(newMcpService);

      // Reset chat history
      resetChatHistory();

      // Clear the screen completely
      process.stdout.write("\x1b[2J\x1b[H");

      // Show the new intro message
      introMessage(newAssistant, newModel, newMcpService);
    } catch (error: any) {
      console.error(`Failed to reload after login: ${error.message}`);
    }
  };

  const {
    messages,
    setMessages,
    isWaitingForResponse,
    responseStartTime,
    inputMode,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
  } = useChat({
    assistant,
    model,
    llmApi,
    initialPrompt,
    resume,
    additionalRules,
    onShowOrgSelector: () => showOrganizationSelector(),
    onShowConfigSelector: () => showConfigSelectorUI(),
    onLoginPrompt: handleLoginPrompt,
    onReload: handleReload,
  });

  const { renderMessage } = useMessageRenderer();

  const {
    showOrgSelector,
    handleOrganizationSelect,
    handleOrganizationCancel,
    showOrganizationSelector,
  } = useOrganizationSelector({
    configPath,
    onAssistantChange: (newAssistant, newModel, newLlmApi, newMcpService) => {
      setAssistant(newAssistant);
      setModel(newModel);
      setLlmApi(newLlmApi);
      setMcpService(newMcpService);
    },
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  const {
    showConfigSelector,
    handleConfigSelect,
    handleConfigCancel,
    showConfigSelectorUI,
  } = useConfigSelector({
    configPath,
    onAssistantChange: (newAssistant, newModel, newLlmApi, newMcpService) => {
      setAssistant(newAssistant);
      setModel(newModel);
      setLlmApi(newLlmApi);
      setMcpService(newMcpService);
    },
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up all available space above input */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {messages.map(renderMessage)}
      </Box>

      {/* Fixed bottom section */}
      <Box flexDirection="column" flexShrink={0}>
        {/* Status */}
        {isWaitingForResponse && responseStartTime && (
          <Box paddingX={1} flexDirection="row" gap={1}>
            <LoadingAnimation visible={isWaitingForResponse} />
            <Text color="gray">(</Text>
            <Timer startTime={responseStartTime} />
            <Text color="gray">• esc to interrupt )</Text>
          </Box>
        )}

        {/* Login prompt - shows above input when active */}
        {loginPrompt && (
          <Box
            paddingX={1}
            borderStyle="round"
            borderColor="yellow"
            flexDirection="column"
            gap={1}
          >
            <Text color="yellow" bold>
              Login Required
            </Text>
            <Text>{loginPrompt.text}</Text>
            <UserInput
              onSubmit={handleLoginTokenSubmit}
              isWaitingForResponse={false}
              inputMode={true}
              assistant={assistant}
              disabled={false}
              placeholder="Enter your token..."
              hideNormalUI={true}
            />
          </Box>
        )}

        {/* Organization selector - shows above input when active */}
        {showOrgSelector && (
          <OrganizationSelector
            onSelect={handleOrganizationSelect}
            onCancel={handleOrganizationCancel}
          />
        )}

        {/* Config selector - shows above input when active */}
        {showConfigSelector && (
          <ConfigSelector
            onSelect={handleConfigSelect}
            onCancel={handleConfigCancel}
          />
        )}

        {/* Input area - always at bottom */}
        <UserInput
          onSubmit={handleUserMessage}
          isWaitingForResponse={isWaitingForResponse}
          inputMode={inputMode}
          onInterrupt={handleInterrupt}
          assistant={assistant}
          onFileAttached={handleFileAttached}
          disabled={showOrgSelector || showConfigSelector || !!loginPrompt}
        />
        <Box marginRight={2} justifyContent="flex-end">
          <Text color="gray">● Continue CLI</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default TUIChat;
