import { AssistantUnrolled } from "@continuedev/config-yaml";
import { BaseLlmApi } from "@continuedev/openai-adapters";
import { Box, Text } from "ink";
import React, { useState } from "react";
import { MCPService } from "../mcp.js";
import { useChat } from "./hooks/useChat.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import { useOrganizationSelector } from "./hooks/useOrganizationSelector.js";
import LoadingAnimation from "./LoadingAnimation.js";
import OrganizationSelector from "./OrganizationSelector.js";
import UserInput from "./UserInput.js";

interface TUIChatProps {
  config: AssistantUnrolled;
  model: string;
  llmApi: BaseLlmApi;
  mcpService: MCPService;
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
}


const TUIChat: React.FC<TUIChatProps> = ({
  config: initialAssistant,
  model: initialModel,
  llmApi: initialLlmApi,
  mcpService: initialMcpService,
  configPath,
  initialPrompt,
  resume,
}) => {
  // Track current assistant configuration state
  const [assistant, setAssistant] = useState(initialAssistant);
  const [model, setModel] = useState(initialModel);
  const [llmApi, setLlmApi] = useState(initialLlmApi);
  const [mcpService, setMcpService] = useState(initialMcpService);

  const {
    messages,
    setMessages,
    isWaitingForResponse,
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
    onShowOrgSelector: () => showOrganizationSelector(),
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


  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up all available space above input */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {messages.map(renderMessage)}
      </Box>

      {/* Fixed bottom section */}
      <Box flexDirection="column" flexShrink={0}>
        {/* Status */}
        {isWaitingForResponse && (
          <Box paddingX={1} flexDirection="row" gap={1}>
            <LoadingAnimation visible={isWaitingForResponse} />
            <Text color="gray">esc to interrupt</Text>
          </Box>
        )}

        {/* Organization selector - shows above input when active */}
        {showOrgSelector && (
          <OrganizationSelector
            onSelect={handleOrganizationSelect}
            onCancel={handleOrganizationCancel}
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
          disabled={showOrgSelector}
        />
        <Box marginRight={2} justifyContent="flex-end">
          <Text color="gray">● Continue CLI</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default TUIChat;
