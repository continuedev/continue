import type { Session, ToolStatus } from "core/index.js";

import { streamChatResponse } from "../stream/streamChatResponse.js";
import { StreamCallbacks } from "../stream/streamChatResponse.types.js";

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
    onToolResult: (_: string, __: string, ___: ToolStatus) => {
      // Note: handleToolCalls already updates the tool call states in history
      // This callback is just for notification/UI updates
    },
    onToolError: (error: string, toolName?: string) => {
      // Note: handleToolCalls and preprocessStreamedToolCalls already handle errors
      // This callback is just for notification/UI updates
      // If we need to display a generic error message (no tool name), add it
      if (!toolName) {
        state.session.history.push({
          message: { role: "system", content: error },
          contextItems: [],
        });
      }
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

      // Add a system message indicating permission is needed
      state.session.history.push({
        message: {
          role: "system",
          content: `WARNING: Tool ${toolName} requires permission`,
        },
        contextItems: [],
      });

      // Don't wait here - the streamChatResponse will handle waiting
    },
    onSystemMessage: (message: string) => {
      state.session.history.push({
        message: {
          role: "system",
          content: message,
        },
        contextItems: [],
      });
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
  messageQueue: string[];
  currentAbortController: AbortController | null;
  shouldInterrupt: boolean;
  serverRunning: boolean;
  pendingPermission: PendingPermission | null;
  systemMessage?: string;
}
