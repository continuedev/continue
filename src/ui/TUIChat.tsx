import { Box, Text, useApp, useStdout } from "ink";
import React, { useEffect, useMemo, useState } from "react";
import { useServices } from "../hooks/useService.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";
import ConfigSelector from "./ConfigSelector.js";
import { startFileIndexing } from "./FileSearchUI.js";
import FreeTrialStatus from "./FreeTrialStatus.js";
import FreeTrialTransitionUI from "./FreeTrialTransitionUI.js";
import { useChat } from "./hooks/useChat.js";
import { useConfigSelector } from "./hooks/useConfigSelector.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import { useOrganizationSelector } from "./hooks/useOrganizationSelector.js";
import IntroMessage from "./IntroMessage.js";
import LoadingAnimation from "./LoadingAnimation.js";
import OrganizationSelector from "./OrganizationSelector.js";
import Timer from "./Timer.js";
import UpdateNotification from "./UpdateNotification.js";
import UserInput from "./UserInput.js";
import { getGitRemoteUrl, getRepoUrl, isGitRepo } from "../util/git.js";
import useTerminalSize from "./hooks/useTerminalSize.js";

interface TUIChatProps {
  // Remote mode props
  remoteUrl?: string;

  // Local mode props - now optional since we'll get them from services
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
}

const TUIChat: React.FC<TUIChatProps> = ({
  remoteUrl,
  configPath,
  initialPrompt,
  resume,
  additionalRules,
}) => {
  // Check if we're in remote mode
  const isRemoteMode = useMemo(() => {
    return !!remoteUrl;
  }, [remoteUrl]);

  const repoURlText = useMemo(() => {
    let url = remoteUrl ?? "";
    if (!url) {
      const isGit = isGitRepo();
      if (isGit) {
        const gitUrl = getGitRemoteUrl();
        if (gitUrl) {
          url = gitUrl;
        }
      }
    }
    if (!url) {
      url = process.cwd();
    }

    url = url.replace(/\.git$/, "");
    url = url.replace(/^(https|http):\/\/.*?\//, "");
    return url;
  }, [remoteUrl]);

  // Get all services reactively - only in normal mode
  const {
    services,
    loading: servicesLoading,
    error: servicesError,
    allReady: allServicesReady,
  } = useServices<{
    auth: AuthServiceState;
    config: ConfigServiceState;
    model: ModelServiceState;
    mcp: MCPServiceState;
    apiClient: ApiClientServiceState;
  }>(["auth", "config", "model", "mcp", "apiClient"]);

  // State for login prompt handling
  const [loginPrompt, setLoginPrompt] = useState<{
    text: string;
    resolve: (value: string) => void;
  } | null>(null);
  const [loginToken, setLoginToken] = useState("");

  // State for free trial transition
  const [isShowingFreeTrialTransition, setIsShowingFreeTrialTransition] =
    useState(false);

  // State for intro message display
  const [showIntroMessage, setShowIntroMessage] = useState(false);

  // Start file indexing as soon as the component mounts
  useEffect(() => {
    // Start indexing files in the background immediately
    startFileIndexing().catch((error) => {
      console.error("Failed to start file indexing:", error);
    });
  }, []);

  // Show intro message when services are ready (only in non-remote mode)
  useEffect(() => {
    if (!isRemoteMode) {
      if (
        allServicesReady &&
        services.config?.config &&
        services.model?.model &&
        services.mcp?.mcpService
      ) {
        setShowIntroMessage(true);
      } else {
        // Reset intro message when services are not ready (during transitions)
        setShowIntroMessage(false);
      }
    }
  }, [
    isRemoteMode,
    allServicesReady,
    services.config?.config,
    services.model?.model,
    services.mcp?.mcpService,
  ]);

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

  // Service reload handlers - these will trigger reactive updates
  const handleReload = async () => {
    // Services will automatically update the UI when they reload
    // We just need to reset chat history, intro message, and clear the screen
    resetChatHistory();
    setShowIntroMessage(false);
    process.stdout.write("\x1b[2J\x1b[H");
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
    assistant: services.config?.config || undefined,
    model: services.model?.model || undefined,
    llmApi: services.model?.llmApi || undefined,
    initialPrompt,
    resume,
    additionalRules,
    onShowOrgSelector: () => showOrganizationSelector(),
    onShowConfigSelector: () => showConfigSelectorUI(),
    onLoginPrompt: handleLoginPrompt,
    onReload: handleReload,
    // Remote mode configuration
    isRemoteMode,
    remoteUrl,
  });

  const { renderMessage } = useMessageRenderer();

  const {
    showOrgSelector,
    handleOrganizationSelect,
    handleOrganizationCancel,
    showOrganizationSelector,
  } = useOrganizationSelector({
    configPath,
    onAssistantChange: (newAssistant, newModel, newLlmApi, newMcpService) => {},
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
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  // Handle free trial transition completion
  const handleFreeTrialTransitionComplete = () => {
    setIsShowingFreeTrialTransition(false);
    handleReload();
  };

  const handleFreeTrialSwitchToLocal = () => {
    setIsShowingFreeTrialTransition(false);
    handleReload();
  };

  const handleFreeTrialFullReload = () => {
    setIsShowingFreeTrialTransition(false);
    handleReload();
  };

  // Determine if input should be disabled
  // Allow input even when services are loading, but disable for UI overlays
  const isInputDisabled =
    showOrgSelector ||
    showConfigSelector ||
    !!loginPrompt ||
    isShowingFreeTrialTransition;

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up all available space above input */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {/* Debug component - comment out when not needed */}
        {/* {!isRemoteMode && (
          <ServiceDebugger
            services={services}
            loading={servicesLoading}
            error={servicesError}
            allReady={allServicesReady}
            servicesLoading={servicesLoading}
            servicesError={servicesError}
          />
        )} */}

        {/* Show intro message when ready */}
        {showIntroMessage &&
          !isRemoteMode &&
          services.config?.config &&
          services.model?.model &&
          services.mcp?.mcpService && (
            <IntroMessage
              config={services.config.config}
              model={services.model.model}
              mcpService={services.mcp.mcpService}
            />
          )}
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
              assistant={services.config?.config || undefined}
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

        {/* Free trial transition UI - replaces input when active */}
        {isShowingFreeTrialTransition && (
          <FreeTrialTransitionUI
            onComplete={handleFreeTrialTransitionComplete}
            onSwitchToLocalConfig={handleFreeTrialSwitchToLocal}
            onFullReload={handleFreeTrialFullReload}
          />
        )}

        {/* Input area - only show when not showing free trial transition */}
        {!isShowingFreeTrialTransition && (
          <UserInput
            onSubmit={handleUserMessage}
            isWaitingForResponse={isWaitingForResponse}
            inputMode={inputMode}
            onInterrupt={handleInterrupt}
            assistant={services.config?.config || undefined}
            onFileAttached={handleFileAttached}
            disabled={isInputDisabled}
            isRemoteMode={isRemoteMode}
          />
        )}

        {/* Free trial status and Continue CLI info - always show */}
        <Box
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Text color="dim" wrap="truncate-start">
              {repoURlText}
            </Text>
          </Box>
          <Box>
            {!isRemoteMode && services.model?.model && (
              <FreeTrialStatus
                apiClient={services.apiClient?.apiClient || undefined}
                model={services.model.model}
                onTransitionStateChange={setIsShowingFreeTrialTransition}
              />
            )}
          </Box>
          <Box marginRight={2} marginLeft={2}>
            <UpdateNotification isRemoteMode={isRemoteMode} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TUIChat;
