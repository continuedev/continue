import { Box, Text } from "ink";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useServices } from "../hooks/useService.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";

import { BottomStatusBar } from "./components/BottomStatusBar.js";
import { ResourceDebugBar } from "./components/ResourceDebugBar.js";
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

// Helper function to load and set session
async function loadAndSetSession(
  sessionId: string,
  closeCurrentScreen: () => void,
  setChatHistory: (history: any) => void,
  setMessages: (messages: any) => void,
  setShowIntroMessage: (show: boolean) => void,
) {
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
      .filter((msg: any) => msg.role !== "system")
      .map((msg: any) => ({
        role: msg.role,
        content: msg.content as string,
      }));

    setMessages(displayMessages);

    // Clear the intro message since we're now showing a resumed session
    setShowIntroMessage(false);
  } catch (error) {
    console.error("Error loading session:", error);
  }
}

// Custom hook to manage services
function useTUIChatServices(remoteUrl?: string) {
  const isRemoteMode = useMemo(() => !!remoteUrl, [remoteUrl]);

  const { services, allReady: allServicesReady } = useServices<{
    auth: AuthServiceState;
    config: ConfigServiceState;
    model: ModelServiceState;
    mcp: MCPServiceState;
    apiClient: ApiClientServiceState;
  }>(["auth", "config", "model", "mcp", "apiClient"]);

  return { services, allServicesReady, isRemoteMode };
}

// Custom hook for chat handlers
function useChatHandlers(
  setShowIntroMessage: (show: boolean) => void,
  setStaticRefreshTrigger: React.Dispatch<React.SetStateAction<number>>,
) {
  // Temporary refs to avoid circular dependency
  const resetChatHistoryRef = useRef<(() => void) | null>(null);

  // Handle clearing chat and resetting intro message
  const handleClear = useCallback(() => {
    setShowIntroMessage(true);
    // Trigger static content refresh by incrementing the trigger
    setStaticRefreshTrigger((prev) => prev + 1);
  }, [setShowIntroMessage, setStaticRefreshTrigger]);

  // Service reload handlers - these will trigger reactive updates
  const handleReload = useCallback(async () => {
    // Services will automatically update the UI when they reload
    // We just need to reset chat history, intro message, and clear the screen
    if (resetChatHistoryRef.current) {
      resetChatHistoryRef.current();
    }
    setShowIntroMessage(false);
    process.stdout.write("\x1b[2J\x1b[H");
  }, [setShowIntroMessage]);

  return {
    handleClear,
    handleReload,
    resetChatHistoryRef,
  };
}

// eslint-disable-next-line complexity
const TUIChat: React.FC<TUIChatProps> = ({
  remoteUrl,
  configPath,
  initialPrompt,
  resume,
  additionalRules,
  additionalPrompts,
}) => {
  // Use custom hook for services
  const { services, allServicesReady, isRemoteMode } =
    useTUIChatServices(remoteUrl);

  const repoURlText = useMemo(() => getRepoUrlText(remoteUrl), [remoteUrl]);

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

  // State to trigger static content refresh for /clear command
  const [staticRefreshTrigger, setStaticRefreshTrigger] = useState(0);

  // Use chat handlers hook
  const { handleClear, handleReload, resetChatHistoryRef } = useChatHandlers(
    setShowIntroMessage,
    setStaticRefreshTrigger,
  );

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

  // Update ref after useChat returns
  useEffect(() => {
    resetChatHistoryRef.current = resetChatHistory;
  }, [resetChatHistory]);

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
  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      await loadAndSetSession(
        sessionId,
        closeCurrentScreen,
        setChatHistory,
        setMessages,
        setShowIntroMessage,
      );
    },
    [closeCurrentScreen, setChatHistory, setMessages, setShowIntroMessage],
  );

  // Determine if input should be disabled
  // Allow input even when services are loading, but disable for UI overlays
  const isInputDisabled =
    navState.currentScreen !== "chat" || !!activePermissionRequest;

  // Check if verbose mode is enabled for resource debugging
  const isVerboseMode = useMemo(() => process.argv.includes("--verbose"), []);

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

        {/* Resource debug bar - only in verbose mode */}
        {isVerboseMode && !isRemoteMode && (
          <ResourceDebugBar visible={navState.currentScreen === "chat"} />
        )}

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
