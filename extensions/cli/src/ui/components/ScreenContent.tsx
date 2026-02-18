import { Box, Text } from "ink";
import React from "react";

import { UpdateServiceState } from "src/services/types.js";

import type { ChatHistoryItem } from "../../../../../core/index.js";
import { ConfigSelector } from "../ConfigSelector.js";
import type { NavigationScreen } from "../context/NavigationContext.js";
import { DiffViewer } from "../DiffViewer.js";
import { EditMessageSelector } from "../EditMessageSelector.js";
import { FreeTrialTransitionUI } from "../FreeTrialTransitionUI.js";
import type { ActivePermissionRequest } from "../hooks/useChat.types.js";
import { MCPSelector } from "../MCPSelector.js";
import { ModelSelector } from "../ModelSelector.js";
import type { ConfigOption, ModelOption } from "../types/selectorTypes.js";
import { UpdateSelector } from "../UpdateSelector.js";
import { UserInput } from "../UserInput.js";

import { ChatScreenContent } from "./ChatScreenContent.js";
import { SessionSelectorWithLoading } from "./SessionSelectorWithLoading.js";

interface ScreenContentProps {
  isScreenActive: (screen: NavigationScreen) => boolean;
  navState: any;
  services: any;
  handleLoginTokenSubmit: (token: string) => void;
  handleConfigSelect: (config: ConfigOption) => Promise<void>;
  handleModelSelect: (model: ModelOption) => Promise<void>;
  handleSessionSelect: (sessionId: string) => Promise<void>;
  handleReload: () => Promise<void>;
  closeCurrentScreen: () => void;
  activePermissionRequest: ActivePermissionRequest | null;
  handleToolPermissionResponse: (
    requestId: string,
    approved: boolean,
    createPolicy?: boolean,
    stopStream?: boolean,
  ) => void;
  handleUserMessage: (message: string, imageMap?: Map<string, Buffer>) => void;
  isWaitingForResponse: boolean;
  isCompacting: boolean;
  inputMode: boolean;
  handleInterrupt: () => void;
  handleFileAttached: (filePath: string, content: string) => void;
  isInputDisabled: boolean;
  wasInterrupted?: boolean;
  isRemoteMode: boolean;
  onImageInClipboardChange?: (hasImage: boolean) => void;
  diffContent?: string;
  chatHistory?: ChatHistoryItem[];
  handleEditMessage?: (messageIndex: number, newContent: string) => void;
  onShowEditSelector?: () => void;
}

function hideScreenContent(state?: UpdateServiceState) {
  return (
    (state?.status === "checking" && state?.autoUpdate) ||
    (state?.isAutoUpdate &&
      (state?.status === "updating" || state?.status === "updated"))
  );
}

export const ScreenContent: React.FC<ScreenContentProps> = ({
  isScreenActive,
  navState,
  services,
  handleLoginTokenSubmit,
  handleConfigSelect,
  handleModelSelect,
  handleSessionSelect,
  handleReload,
  closeCurrentScreen,
  activePermissionRequest,
  handleToolPermissionResponse,
  handleUserMessage,
  isWaitingForResponse,
  isCompacting,
  inputMode,
  handleInterrupt,
  handleFileAttached,
  isInputDisabled,
  wasInterrupted = false,
  isRemoteMode,
  onImageInClipboardChange,
  diffContent,
  chatHistory = [],
  handleEditMessage,
  onShowEditSelector,
}) => {
  if (hideScreenContent(services.update)) {
    return null;
  }

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

  // Config selector
  if (isScreenActive("config")) {
    return (
      <ConfigSelector
        onSelect={handleConfigSelect}
        onCancel={closeCurrentScreen}
      />
    );
  }

  if (isScreenActive("mcp")) {
    return <MCPSelector onCancel={closeCurrentScreen} />;
  }

  if (isScreenActive("update")) {
    return <UpdateSelector onCancel={closeCurrentScreen} />;
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

  // Session selector
  if (isScreenActive("session")) {
    return (
      <SessionSelectorWithLoading
        onSelect={handleSessionSelect}
        onExit={closeCurrentScreen}
      />
    );
  }

  // Free trial transition UI
  if (isScreenActive("free-trial")) {
    return <FreeTrialTransitionUI onReload={handleReload} />;
  }

  // Diff viewer overlay
  if (isScreenActive("diff")) {
    return (
      <DiffViewer
        diffContent={diffContent || ""}
        onClose={closeCurrentScreen}
      />
    );
  }

  // Edit message selector
  if (isScreenActive("edit")) {
    return (
      <EditMessageSelector
        chatHistory={chatHistory}
        onEdit={(messageIndex, newContent) => {
          if (handleEditMessage) {
            handleEditMessage(messageIndex, newContent);
          }
          closeCurrentScreen();
        }}
        onExit={closeCurrentScreen}
      />
    );
  }

  // Chat screen with input area
  if (isScreenActive("chat")) {
    return (
      <ChatScreenContent
        activePermissionRequest={activePermissionRequest}
        handleToolPermissionResponse={handleToolPermissionResponse}
        handleUserMessage={handleUserMessage}
        isWaitingForResponse={isWaitingForResponse}
        isCompacting={isCompacting}
        inputMode={inputMode}
        handleInterrupt={handleInterrupt}
        assistant={services.config?.config || undefined}
        wasInterrupted={wasInterrupted}
        handleFileAttached={handleFileAttached}
        isInputDisabled={isInputDisabled}
        isRemoteMode={isRemoteMode}
        onImageInClipboardChange={onImageInClipboardChange}
        onShowEditSelector={onShowEditSelector}
      />
    );
  }

  return null;
};
