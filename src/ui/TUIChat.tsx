import { Box, Text } from "ink";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useServices } from "../hooks/useService.js";
import type { PermissionMode } from "../permissions/types.js";
import { modeService } from "../services/ModeService.js";
import {
  ApiClientServiceState,
  AuthServiceState,
  ConfigServiceState,
  MCPServiceState,
  ModelServiceState,
} from "../services/types.js";
import { getGitRemoteUrl, isGitRepo } from "../util/git.js";

import { ModeIndicator } from "./components/ModeIndicator.js";
import { StaticChatContent } from "./components/StaticChatContent.js";
import { ToolPermissionSelector } from "./components/ToolPermissionSelector.js";
import { ConfigSelector } from "./ConfigSelector.js";
import {
  useNavigation,
  type NavigationScreen,
} from "./context/NavigationContext.js";
import { startFileIndexing } from "./FileSearchUI.js";
import { FreeTrialStatus } from "./FreeTrialStatus.js";
import { FreeTrialTransitionUI } from "./FreeTrialTransitionUI.js";
import { useChat } from "./hooks/useChat.js";
import { useConfigSelector } from "./hooks/useConfigSelector.js";
import { useMessageRenderer } from "./hooks/useMessageRenderer.js";
import { useModelSelector } from "./hooks/useModelSelector.js";
import { useOrganizationSelector } from "./hooks/useOrganizationSelector.js";
import { LoadingAnimation } from "./LoadingAnimation.js";
import { ModelSelector } from "./ModelSelector.js";
import { OrganizationSelector } from "./OrganizationSelector.js";
import type { SelectorOption } from "./Selector.js";
import { Timer } from "./Timer.js";
import { UpdateNotification } from "./UpdateNotification.js";
import { UserInput } from "./UserInput.js";

// Type definitions for selectors
interface ConfigOption extends SelectorOption {
  type: "local" | "assistant" | "create";
  slug?: string;
}

interface ModelOption extends SelectorOption {
  index: number;
  provider: string;
}

// Helper function to get repo URL text
function getRepoUrlText(remoteUrl?: string): string {
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
}

// Custom hook for intro message
function useIntroMessage(
  isRemoteMode: boolean,
  services: any,
  allServicesReady: boolean,
) {
  const [showIntroMessage, setShowIntroMessage] = useState(false);

  useEffect(() => {
    const shouldShow =
      !isRemoteMode &&
      allServicesReady &&
      !!services.config?.config &&
      !!services.model?.model &&
      !!services.mcp?.mcpService;

    setShowIntroMessage(shouldShow);
  }, [
    isRemoteMode,
    allServicesReady,
    services.config?.config,
    services.model?.model,
    services.mcp?.mcpService,
  ]);

  return [showIntroMessage, setShowIntroMessage] as const;
}

// Custom hook for login handling
function useLoginHandlers(
  navigateTo: any,
  navState: any,
  closeCurrentScreen: () => void,
) {
  const handleLoginPrompt = useCallback(
    (promptText: string): Promise<string> => {
      return new Promise((resolve) => {
        navigateTo("login", { text: promptText, resolve });
      });
    },
    [navigateTo],
  );

  const handleLoginTokenSubmit = useCallback(
    (token: string) => {
      if (navState.screenData?.resolve) {
        navState.screenData.resolve(token);
        closeCurrentScreen();
      }
    },
    [navState.screenData, closeCurrentScreen],
  );

  return { handleLoginPrompt, handleLoginTokenSubmit };
}

// Custom hook for mode tracking
function useCurrentMode() {
  const [currentMode, setCurrentMode] = useState<PermissionMode>(
    modeService.getCurrentMode(),
  );

  useEffect(() => {
    const handleModeChange = (newMode: PermissionMode) => {
      setCurrentMode(newMode);
    };

    modeService.on("modeChanged", handleModeChange);
    return () => {
      modeService.off("modeChanged", handleModeChange);
    };
  }, []);

  return currentMode;
}

// Custom hook to combine all selector logic
function useSelectors(
  configPath: string | undefined,
  setMessages: React.Dispatch<React.SetStateAction<any[]>>,
  resetChatHistory: () => void,
) {
  const { handleOrganizationSelect } = useOrganizationSelector({
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  const { handleConfigSelect } = useConfigSelector({
    configPath,
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
    onChatReset: resetChatHistory,
  });

  const { handleModelSelect } = useModelSelector({
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
  });

  return {
    handleOrganizationSelect,
    handleConfigSelect,
    handleModelSelect,
  };
}

interface TUIChatProps {
  // Remote mode props
  remoteUrl?: string;

  // Local mode props - now optional since we'll get them from services
  configPath?: string;
  initialPrompt?: string;
  resume?: boolean;
  additionalRules?: string[];
}

// Bottom status bar component
interface BottomStatusBarProps {
  currentMode: PermissionMode;
  repoURlText: string;
  isRemoteMode: boolean;
  services: any;
  navState: any;
  navigateTo: (screen: NavigationScreen, data?: any) => void;
  closeCurrentScreen: () => void;
}

const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  currentMode,
  repoURlText,
  isRemoteMode,
  services,
  navState,
  navigateTo,
  closeCurrentScreen,
}) => (
  <Box flexDirection="row" justifyContent="space-between" alignItems="center">
    <Box marginLeft={2} flexDirection="row" alignItems="center">
      {currentMode === "normal" && (
        <>
          <Text color="dim" wrap="truncate-start">
            {repoURlText}
          </Text>
          <Text> </Text>
        </>
      )}
      <ModeIndicator />
    </Box>
    <Box>
      {!isRemoteMode && services.model?.model && (
        <FreeTrialStatus
          apiClient={services.apiClient?.apiClient || undefined}
          model={services.model.model}
          onTransitionStateChange={(shouldShow) => {
            if (shouldShow && navState.currentScreen === "chat") {
              navigateTo("free-trial");
            } else if (!shouldShow && navState.currentScreen === "free-trial") {
              closeCurrentScreen();
            }
          }}
        />
      )}
    </Box>
    <Box marginRight={2} marginLeft={2}>
      <UpdateNotification isRemoteMode={isRemoteMode} />
    </Box>
  </Box>
);

// Component to handle all screen-specific rendering
interface ScreenContentProps {
  isScreenActive: (screen: NavigationScreen) => boolean;
  navState: any;
  services: any;
  handleLoginTokenSubmit: (token: string) => void;
  handleOrganizationSelect: (
    organizationId: string | null,
    organizationName: string,
  ) => Promise<void>;
  handleConfigSelect: (config: ConfigOption) => Promise<void>;
  handleModelSelect: (model: ModelOption) => Promise<void>;
  handleReload: () => Promise<void>;
  closeCurrentScreen: () => void;
  activePermissionRequest: any;
  handleToolPermissionResponse: (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean,
  ) => void;
  handleUserMessage: (message: string) => void;
  isWaitingForResponse: boolean;
  inputMode: boolean;
  handleInterrupt: () => void;
  handleFileAttached: (filePath: string, content: string) => void;
  isInputDisabled: boolean;
  isRemoteMode: boolean;
}

const ScreenContent: React.FC<ScreenContentProps> = ({
  isScreenActive,
  navState,
  services,
  handleLoginTokenSubmit,
  handleOrganizationSelect,
  handleConfigSelect,
  handleModelSelect,
  handleReload,
  closeCurrentScreen,
  activePermissionRequest,
  handleToolPermissionResponse,
  handleUserMessage,
  isWaitingForResponse,
  inputMode,
  handleInterrupt,
  handleFileAttached,
  isInputDisabled,
  isRemoteMode,
}) => {
  // Login prompt
  if (isScreenActive("login") && navState.screenData) {
    return (
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
        <Text>{navState.screenData.text}</Text>
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
    );
  }

  // Organization selector
  if (isScreenActive("organization")) {
    return (
      <OrganizationSelector
        onSelect={handleOrganizationSelect}
        onCancel={closeCurrentScreen}
      />
    );
  }

  // Config selector
  if (isScreenActive("config")) {
    return (
      <ConfigSelector
        onSelect={handleConfigSelect}
        onCancel={closeCurrentScreen}
      />
    );
  }

  // Model selector
  if (isScreenActive("model")) {
    return (
      <ModelSelector
        onSelect={handleModelSelect}
        onCancel={closeCurrentScreen}
      />
    );
  }

  // Free trial transition UI
  if (isScreenActive("free-trial")) {
    return <FreeTrialTransitionUI onReload={handleReload} />;
  }

  // Chat screen with input area
  if (isScreenActive("chat")) {
    if (activePermissionRequest) {
      return (
        <ToolPermissionSelector
          toolName={activePermissionRequest.toolName}
          toolArgs={activePermissionRequest.toolArgs}
          requestId={activePermissionRequest.requestId}
          toolCallPreview={activePermissionRequest.toolCallPreview}
          onResponse={handleToolPermissionResponse}
        />
      );
    }
    return (
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
    );
  }

  return null;
};

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

  // Start file indexing as soon as the component mounts
  useEffect(() => {
    // Start indexing files in the background immediately
    startFileIndexing().catch((error) => {
      console.error("Failed to start file indexing:", error);
    });
  }, []);

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
    onShowOrgSelector: () => navigateTo("organization"),
    onShowConfigSelector: () => navigateTo("config"),
    onShowModelSelector: () => navigateTo("model"),
    onLoginPrompt: handleLoginPrompt,
    onReload: handleReload,
    // Remote mode configuration
    isRemoteMode,
    remoteUrl,
  });

  const { renderMessage } = useMessageRenderer();

  const { handleOrganizationSelect, handleConfigSelect, handleModelSelect } =
    useSelectors(configPath, setMessages, resetChatHistory);

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
        />
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

        {/* All screen-specific content */}
        <ScreenContent
          isScreenActive={isScreenActive}
          navState={navState}
          services={services}
          handleLoginTokenSubmit={handleLoginTokenSubmit}
          handleOrganizationSelect={handleOrganizationSelect}
          handleConfigSelect={handleConfigSelect}
          handleModelSelect={handleModelSelect}
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
          repoURlText={repoURlText}
          isRemoteMode={isRemoteMode}
          services={services}
          navState={navState}
          navigateTo={navigateTo}
          closeCurrentScreen={closeCurrentScreen}
        />
      </Box>
    </Box>
  );
};

export { TUIChat };
