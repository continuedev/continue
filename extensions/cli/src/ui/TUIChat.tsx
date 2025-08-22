import { Box, Text } from "ink";
import React, { useMemo, useState } from "react";

import { useServices } from "../hooks/useService.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";

import { BottomStatusBar } from "./components/BottomStatusBar.js";
import { ScreenContent } from "./components/ScreenContent.js";
import { StaticChatContent } from "./components/StaticChatContent.js";
import { useNavigation } from "./context/NavigationContext.js";
import { useChat } from "./hooks/useChat.js";
import { useContextPercentage } from "./hooks/useContextPercentage.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import {
  getRepoUrlText,
  useCurrentMode,
  useIntroMessage,
  useLoginHandlers,
  useSelectors,
} from "./hooks/useTUIChatHooks.js";
import { LoadingAnimation } from "./LoadingAnimation.js";
import { Timer } from "./Timer.js";

interface TUIChatProps {
  // Remote mode props
  remoteUrl?: string;

  // Local mode props - now optional since we'll get them from services
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
  additionalPrompts?: string[];
}

const TUIChat: React.FC<TUIChatProps> = ({
  remoteUrl,
  configPath,
  initialPrompt,
  resume,
  additionalRules,
  additionalPrompts,
}) => {
  // Check if we're in remote mode
  const isRemoteMode = useMemo(() => {
    return !!remoteUrl;
  }, [remoteUrl]);

  const repoURlText = useMemo(() => getRepoUrlText(remoteUrl), [remoteUrl]);

  // Get all services reactively - only in normal mode
  const { services, allReady: allServicesReady } = useServices<{
    auth: AuthServiceState;
    config: ConfigServiceState;
    model: ModelServiceState;
    mcp: MCPServiceState;
    apiClient: ApiClientServiceState;
  }>(["auth", "config", "model", "mcp", "apiClient"]);

  // Use navigation context
  const {
    state: navState,
    navigateTo,
    closeCurrentScreen,
    isScreenActive,
  } = useNavigation();

  // Use intro message hook
  const [showIntroMessage, setShowIntroMessage] = useIntroMessage(
    isRemoteMode,
    services,
    allServicesReady,
  );

  // State for current mode (for hiding cwd in plan/auto modes)
  const currentMode = useCurrentMode();

  // Use login handlers
  const { handleLoginPrompt, handleLoginTokenSubmit } = useLoginHandlers(
    navigateTo,
    navState,
    closeCurrentScreen,
  );

  // Service reload handlers - these will trigger reactive updates
  const handleReload = async () => {
    // Services will automatically update the UI when they reload
    // We just need to reset chat history, intro message, and clear the screen
    resetChatHistory();
    setShowIntroMessage(false);
    process.stdout.write("\x1b[2J\x1b[H");
  };

  // State to trigger static content refresh for /clear command
  const [staticRefreshTrigger, setStaticRefreshTrigger] = useState(0);

  // Handle clearing chat and resetting intro message
  const handleClear = () => {
    setShowIntroMessage(true);
    // Trigger static content refresh by incrementing the trigger
    setStaticRefreshTrigger((prev) => prev + 1);
  };

  const {
    messages,
    setMessages,
    chatHistory,
    setChatHistory,
    isWaitingForResponse,
    responseStartTime,
    inputMode,
    activePermissionRequest,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
    handleToolPermissionResponse,
  } = useChat({
    assistant: services.config?.config || undefined,
    model: services.model?.model || undefined,
    llmApi: services.model?.llmApi || undefined,
    initialPrompt,
    resume,
    additionalRules,
    additionalPrompts,
    onShowConfigSelector: () => navigateTo("config"),
    onShowModelSelector: () => navigateTo("model"),
    onShowMCPSelector: () => navigateTo("mcp"),
    onShowSessionSelector: () => navigateTo("session"),
    onLoginPrompt: handleLoginPrompt,
    onReload: handleReload,
    onClear: handleClear,
    // Remote mode configuration
    isRemoteMode,
    remoteUrl,
  });

  // Calculate context percentage
  const contextData = useContextPercentage({
    chatHistory,
    model: services.model?.model || undefined,
  });

  const { renderMessage } = useMessageRenderer();

  const { handleConfigSelect, handleModelSelect } = useSelectors(
    configPath,
    setMessages,
    resetChatHistory,
  );

  // Session selection handler
  const handleSessionSelect = async (sessionId: string) => {
    try {
      // Close the session selector
      closeCurrentScreen();

      // Import session functions
      const { loadSessionById } = await import("../session.js");

      // Load the session history
      const sessionHistory = loadSessionById(sessionId);
      if (!sessionHistory) {
        console.error(`Session ${sessionId} could not be loaded.`);
        return;
      }

      // Set the session ID so future operations use this session
      process.env.CONTINUE_CLI_TEST_SESSION_ID = sessionId.replace(
        "continue-cli-",
        "",
      );

      // Directly set the chat history and messages to the loaded session
      setChatHistory(sessionHistory);

      // Convert chat history to display messages (exclude system messages)
      const displayMessages = sessionHistory
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role,
          content: msg.content as string,
        }));

      setMessages(displayMessages);

      // Clear the intro message since we're now showing a resumed session
      setShowIntroMessage(false);
    } catch (error) {
      console.error("Error loading session:", error);
    }
  };

  // Determine if input should be disabled
  // Allow input even when services are loading, but disable for UI overlays
  const isInputDisabled =
    navState.currentScreen !== "chat" || !!activePermissionRequest;

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

        {/* Chat content with intro message and messages in static container */}
        <StaticChatContent
          showIntroMessage={showIntroMessage && !isRemoteMode}
          config={services.config?.config || undefined}
          model={services.model?.model || undefined}
          mcpService={services.mcp?.mcpService || undefined}
          messages={messages}
          renderMessage={renderMessage}
          refreshTrigger={staticRefreshTrigger}
        />
      </Box>

      {/* Fixed bottom section */}
      <Box flexDirection="column" flexShrink={0}>
        {/* Status */}
        {isWaitingForResponse && responseStartTime && (
          <Box paddingX={1} flexDirection="row" gap={1}>
            <LoadingAnimation visible={isWaitingForResponse} />
            <Text key="loading-start" color="gray">
              (
            </Text>
            <Timer startTime={responseStartTime} />
            <Text key="loading-end" color="gray">
              • esc to interrupt )
            </Text>
          </Box>
        )}

        {/* All screen-specific content */}
        <ScreenContent
          isScreenActive={isScreenActive}
          navState={navState}
          services={services}
          handleLoginTokenSubmit={handleLoginTokenSubmit}
          handleConfigSelect={handleConfigSelect}
          handleModelSelect={handleModelSelect}
          handleSessionSelect={handleSessionSelect}
          handleReload={handleReload}
          closeCurrentScreen={closeCurrentScreen}
          activePermissionRequest={activePermissionRequest}
          handleToolPermissionResponse={handleToolPermissionResponse}
          handleUserMessage={handleUserMessage}
          isWaitingForResponse={isWaitingForResponse}
          inputMode={inputMode}
          handleInterrupt={handleInterrupt}
          handleFileAttached={handleFileAttached}
          isInputDisabled={isInputDisabled}
          isRemoteMode={isRemoteMode}
        />

        {/* Free trial status and Continue CLI info - always show */}
        <BottomStatusBar
          currentMode={currentMode}
          repoURLText={repoURlText}
          isRemoteMode={isRemoteMode}
          services={services}
          navState={navState}
          navigateTo={navigateTo}
          closeCurrentScreen={closeCurrentScreen}
          contextPercentage={contextData?.percentage}
        />
      </Box>
    </Box>
  );
};

export { TUIChat };
