import { Box, Text } from "ink";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ToolPermissionServiceState } from "src/services/ToolPermissionService.js";

import { listUserOrganizations } from "../auth/workos.js";
import { useServices } from "../hooks/useService.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
  UpdateServiceState,
} from "../services/types.js";
import { getTotalSessionCost } from "../session.js";
import { logger } from "../util/logger.js";

import { ActionStatus } from "./components/ActionStatus.js";
import { BottomStatusBar } from "./components/BottomStatusBar.js";
import { ResourceDebugBar } from "./components/ResourceDebugBar.js";
import { ScreenContent } from "./components/ScreenContent.js";
import { StaticChatContent } from "./components/StaticChatContent.js";
import { useNavigation } from "./context/NavigationContext.js";
import { useChat } from "./hooks/useChat.js";
import { useContextPercentage } from "./hooks/useContextPercentage.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import {
  useIntroMessage,
  useLoginHandlers,
  useSelectors,
} from "./hooks/useTUIChatHooks.js";

interface TUIChatProps {
  // Remote mode props
  remoteUrl?: string;

  // Local mode props - now optional since we'll get them from services
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
  fork?: string;
  additionalRules?: string[];
  additionalPrompts?: string[];
}

// Helper function to load and set session
async function loadAndSetSession(
  sessionId: string,
  closeCurrentScreen: () => void,
  setChatHistory: (history: any) => void,
  setShowIntroMessage: (show: boolean) => void,
) {
  try {
    // Close the session selector
    closeCurrentScreen();

    // Import session functions
    const { loadSessionById } = await import("../session.js");

    // Load the session
    const session = loadSessionById(sessionId);
    if (!session) {
      logger.error(`Session ${sessionId} could not be loaded.`);
      return;
    }

    // Set the session ID so future operations use this session
    process.env.CONTINUE_CLI_TEST_SESSION_ID = sessionId.replace(
      "continue-cli-",
      "",
    );

    // Set the chat history from the session
    setChatHistory(session.history);

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
    update: UpdateServiceState;
    toolPermissions: ToolPermissionServiceState;
  }>([
    "auth",
    "config",
    "model",
    "mcp",
    "apiClient",
    "update",
    "toolPermissions",
  ]);

  return { services, allServicesReady, isRemoteMode };
}

// Custom hook to fetch organization name
function useOrganizationName(organizationId?: string): string | undefined {
  const [organizationName, setOrganizationName] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!organizationId) {
      setOrganizationName(undefined);
      return;
    }

    let isMounted = true;

    async function fetchOrgName() {
      try {
        const orgs = await listUserOrganizations();
        if (!isMounted) return;

        const org = orgs?.find((o) => o.id === organizationId);
        if (org) {
          setOrganizationName(org.name);
        }
      } catch (error) {
        logger.debug("Failed to fetch organization name", { error });
      }
    }

    fetchOrgName();

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  return organizationName;
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
  fork,
  additionalRules,
  additionalPrompts,
}) => {
  // Use custom hook for services
  const { services, allServicesReady, isRemoteMode } =
    useTUIChatServices(remoteUrl);

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

  // Use login handlers
  const { handleLoginTokenSubmit } = useLoginHandlers(
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

  // State for diff content overlay
  const [diffContent, setDiffContent] = useState<string>("");

  // State for temporary status message
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Handler to show diff overlay
  const handleShowDiff = useCallback(
    (content: string) => {
      setDiffContent(content);
      navigateTo("diff");
    },
    [navigateTo],
  );

  // Handler to show temporary status message
  const handleShowStatusMessage = useCallback((message: string) => {
    setStatusMessage(message);
    // Clear after 3 seconds
    setTimeout(() => {
      setStatusMessage("");
    }, 3000);
  }, []);

  const {
    chatHistory,
    setChatHistory,
    isWaitingForResponse,
    responseStartTime,
    isCompacting,
    compactionStartTime,
    inputMode,
    activePermissionRequest,
    wasInterrupted,
    queuedMessages,
    handleUserMessage,
    handleInterrupt,
    handleFileAttached,
    resetChatHistory,
    handleEditMessage,
    handleToolPermissionResponse,
  } = useChat({
    assistant: services.config?.config || undefined,
    model: services.model?.model || undefined,
    llmApi: services.model?.llmApi || undefined,
    initialPrompt,
    resume,
    fork,
    additionalRules,
    additionalPrompts,
    onShowConfigSelector: () => navigateTo("config"),
    onShowModelSelector: () => navigateTo("model"),
    onShowMCPSelector: () => navigateTo("mcp"),
    onShowUpdateSelector: () => navigateTo("update"),
    onShowSessionSelector: () => navigateTo("session"),
    onReload: handleReload,
    onClear: handleClear,
    onRefreshStatic: () => setStaticRefreshTrigger((prev) => prev + 1),
    // Remote mode configuration
    isRemoteMode,
    remoteUrl,
    onShowDiff: handleShowDiff,
    onShowStatusMessage: handleShowStatusMessage,
  });

  // Update ref after useChat returns
  useEffect(() => {
    resetChatHistoryRef.current = resetChatHistory;
  }, [resetChatHistory]);

  // Memoize the chat history conversion to avoid expensive recalculation on every render

  // Calculate context percentage
  const contextData = useContextPercentage({
    chatHistory,
    model: services.model?.model || undefined,
  });

  const { renderMessage } = useMessageRenderer();

  const { handleConfigSelect, handleModelSelect } = useSelectors(
    configPath,
    setChatHistory,
    handleClear,
    setStaticRefreshTrigger,
  );

  // Session selection handler
  const handleSessionSelect = useCallback(
    async (sessionId: string) => {
      await loadAndSetSession(
        sessionId,
        closeCurrentScreen,
        setChatHistory,
        setShowIntroMessage,
      );
    },
    [closeCurrentScreen, setChatHistory, setShowIntroMessage],
  );

  // Determine if input should be disabled
  // Allow input even when services are loading, but disable for UI overlays
  const isInputDisabled =
    navState.currentScreen !== "chat" || !!activePermissionRequest;

  // Check if verbose mode is enabled for resource debugging
  const isVerboseMode = useMemo(() => process.argv.includes("--verbose"), []);

  // State for image in clipboard status
  const [hasImageInClipboard, setHasImageInClipboard] = useState(false);

  // Fetch organization name based on auth state
  const organizationName = useOrganizationName(services.auth?.organizationId);

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat history - takes up all available space above input */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
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
          organizationName={organizationName}
          chatHistory={chatHistory}
          queuedMessages={queuedMessages}
          renderMessage={renderMessage}
          refreshTrigger={staticRefreshTrigger}
        />
      </Box>

      {/* Fixed bottom section */}
      <Box flexDirection="column" flexShrink={0}>
        {/* Status */}
        <ActionStatus
          visible={isWaitingForResponse && !!responseStartTime}
          startTime={responseStartTime || 0}
          message=""
          showSpinner={true}
        />

        {/* Compaction Status */}
        <ActionStatus
          visible={isCompacting && !!compactionStartTime}
          startTime={compactionStartTime || 0}
          message="Compacting history"
          showSpinner={true}
          loadingColor="grey"
        />

        {/* Temporary status message */}
        {statusMessage && (
          <Box paddingX={1} paddingY={0}>
            <Text color="green">{statusMessage}</Text>
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
          isCompacting={isCompacting}
          inputMode={inputMode}
          handleInterrupt={handleInterrupt}
          handleFileAttached={handleFileAttached}
          isInputDisabled={isInputDisabled}
          wasInterrupted={wasInterrupted}
          isRemoteMode={isRemoteMode}
          onImageInClipboardChange={setHasImageInClipboard}
          diffContent={diffContent}
          chatHistory={chatHistory}
          handleEditMessage={handleEditMessage}
          onShowEditSelector={() => navigateTo("edit")}
        />

        {/* Resource debug bar - only in verbose mode */}
        {isVerboseMode && !isRemoteMode && (
          <ResourceDebugBar visible={navState.currentScreen === "chat"} />
        )}

        {/* Free trial status and Continue CLI info - always show */}
        <BottomStatusBar
          currentMode={services?.toolPermissions?.currentMode ?? "normal"}
          remoteUrl={remoteUrl}
          isRemoteMode={isRemoteMode}
          services={services}
          navState={navState}
          navigateTo={navigateTo}
          closeCurrentScreen={closeCurrentScreen}
          contextPercentage={contextData?.percentage}
          hasImageInClipboard={hasImageInClipboard}
          isVerboseMode={isVerboseMode}
          totalCost={getTotalSessionCost()}
        />
      </Box>
    </Box>
  );
};

export { TUIChat };
