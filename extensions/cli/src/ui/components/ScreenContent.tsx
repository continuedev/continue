import { Box, Text } from "ink";
import React from "react";

import { listSessions } from "../../session.js";
import { ConfigSelector } from "../ConfigSelector.js";
import type { NavigationScreen } from "../context/NavigationContext.js";
import { FreeTrialTransitionUI } from "../FreeTrialTransitionUI.js";
import { MCPSelector } from "../MCPSelector.js";
import { ModelSelector } from "../ModelSelector.js";
import { SessionSelector } from "../SessionSelector.js";
import type { ConfigOption, ModelOption } from "../types/selectorTypes.js";
import { UserInput } from "../UserInput.js";

import { ToolPermissionSelector } from "./ToolPermissionSelector.js";

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
  activePermissionRequest: any;
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
    const sessions = listSessions(20);
    return (
      <SessionSelector
        sessions={sessions}
        onSelect={handleSessionSelect}
        onExit={closeCurrentScreen}
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
          hasDynamicEvaluation={activePermissionRequest.hasDynamicEvaluation}
          onResponse={handleToolPermissionResponse}
        />
      );
    }
    return (
      <UserInput
        onSubmit={handleUserMessage}
        isWaitingForResponse={isWaitingForResponse}
        isCompacting={isCompacting}
        inputMode={inputMode}
        onInterrupt={handleInterrupt}
        assistant={services.config?.config || undefined}
        wasInterrupted={wasInterrupted}
        onFileAttached={handleFileAttached}
        disabled={isInputDisabled}
        isRemoteMode={isRemoteMode}
        onImageInClipboardChange={onImageInClipboardChange}
      />
    );
  }

  return null;
};
