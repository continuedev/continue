import type { Session, ToolCallState, ToolStatus } from "core/index.js";

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
    onToolStart: (toolName: string, toolArgs?: any) => {
      // Always create a new assistant message for each tool call
      const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const toolCall = {
        id: toolCallId,
        type: "function" as const,
        function: {
          name: toolName,
          arguments: JSON.stringify(toolArgs || {}),
        },
      };
      const toolCallState: ToolCallState = {
        toolCallId: toolCallId,
        toolCall: toolCall,
        status: "calling",
        parsedArgs: toolArgs,
      };

      state.session.history.push({
        message: {
          role: "assistant",
          content: "",
          toolCalls: [toolCall],
        },
        contextItems: [],
        toolCallStates: [toolCallState],
      });
    },
    onToolResult: (result: string, toolName: string, status: ToolStatus) => {
      // Find and update the corresponding tool call state
      for (let i = state.session.history.length - 1; i >= 0; i--) {
        const item = state.session.history[i];
        if (item.toolCallStates) {
          const toolState = item.toolCallStates.find(
            (ts: ToolCallState) =>
              ts.toolCall.function.name === toolName && ts.status === "calling",
          );
          if (toolState) {
            toolState.status = status;
            toolState.output = [
              {
                content: result,
                name: `Tool Result: ${toolName}`,
                description: "Tool execution result",
              },
            ];
            break;
          }
        }
      }
    },
    onToolError: (error: string, toolName?: string) => {
      if (toolName) {
        // Find and update the corresponding tool call state
        for (let i = state.session.history.length - 1; i >= 0; i--) {
          const item = state.session.history[i];
          if (item.toolCallStates) {
            const toolState = item.toolCallStates.find(
              (ts: ToolCallState) =>
                ts.toolCall.function.name === toolName &&
                ts.status === "calling",
            );
            if (toolState) {
              toolState.status = "errored";
              toolState.output = [
                {
                  content: error,
                  name: `Tool Error: ${toolName}`,
                  description: "Tool execution error",
                },
              ];
              break;
            }
          }
        }
      }
      // Generic error if tool not found
      state.session.history.push({
        message: { role: "system", content: error },
        contextItems: [],
      });
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
