import type { Session, ToolStatus } from "core/index.js";

import { services } from "../services/index.js";
import { streamChatResponse } from "../stream/streamChatResponse.js";
import { StreamCallbacks } from "../stream/streamChatResponse.types.js";
import { logger } from "../util/logger.js";

// Modified version of streamChatResponse that supports interruption
export async function streamChatResponseWithInterruption(
  state: ServerState,
  llmApi: any,
  abortController: AbortController,
  shouldInterrupt: () => boolean,
): Promise<string> {
  // Import the original streamChatResponse logic but add interruption checks
  // Create a wrapper that checks for interruption
  const originalSignal = abortController.signal;
  const checkInterruption = () => {
    if (shouldInterrupt() && !originalSignal.aborted) {
      abortController.abort();
    }
  };

  // Set up periodic interruption checks
  const interruptionChecker = setInterval(checkInterruption, 100);

  // Create callbacks to capture tool events
  const callbacks: StreamCallbacks = {
    onContent: (_: string) => {
      // onContent is empty - doesn't update history during streaming
      // This is just for real-time display purposes
    },
    onContentComplete: (_: string) => {
      // Note: streamChatResponse already adds messages to history via handleToolCalls
      // so we don't need to add them here - this callback is just for notification
      // that content streaming is complete
    },
    onToolStart: (__: string, _?: any) => {
      // Note: handleToolCalls already adds the tool call message to history
      // This callback is just for notification/UI updates
      // The tool call state is already created and added by handleToolCalls
    },
    onToolResult: (_result: string, _toolName: string, _status: ToolStatus) => {
      // No-op when using ChatHistoryService; it updates tool states/results
    },
    onToolError: (_error: string, _toolName?: string) => {
      // No-op; errors are added to history via handleToolCalls flow
    },
    onToolPermissionRequest: (
      toolName: string,
      toolArgs: any,
      requestId: string,
      toolCallPreview?: any[],
    ) => {
      // Set pending permission state
      state.pendingPermission = {
        toolName,
        toolArgs,
        requestId,
        timestamp: Date.now(),
        toolCallPreview,
      };

      // Add a system message indicating permission is needed via service
      try {
        services.chatHistory.addSystemMessage(
          `WARNING: Tool ${toolName} requires permission`,
        );
      } catch (err) {
        // Do not mutate session history; ChatHistoryService is the source of truth
        logger.error(
          "Failed to add system message via ChatHistoryService",
          err,
          { context: "onToolPermissionRequest", toolName, requestId },
        );
      }

      // Don't wait here - the streamChatResponse will handle waiting
    },
    onSystemMessage: (message: string) => {
      try {
        services.chatHistory.addSystemMessage(message);
      } catch (err) {
        // Do not mutate session history; ChatHistoryService is the source of truth
        logger.error(
          "Failed to add system message via ChatHistoryService",
          err,
          { context: "onSystemMessage" },
        );
      }
    },
  };

  try {
    const response = await streamChatResponse(
      state.session.history,
      state.model,
      llmApi,
      abortController,
      callbacks,
    );
    return response || "";
  } finally {
    clearInterval(interruptionChecker);
  }
}

export interface PendingPermission {
  toolName: string;
  toolArgs: any;
  requestId: string;
  timestamp: number;
  toolCallPreview?: any[];
}

export interface ServerState {
  session: Session;
  config: any;
  model: any;
  isProcessing: boolean;
  lastActivity: number;
  currentAbortController: AbortController | null;
  serverRunning: boolean;
  pendingPermission: PendingPermission | null;
  systemMessage?: string;
}
