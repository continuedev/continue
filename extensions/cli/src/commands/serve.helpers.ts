import type {
  ChatHistoryItem,
  Session,
  ToolCallState,
  ToolStatus,
} from "../../../../core/index.js";
import { streamChatResponse } from "../streamChatResponse.js";
import { StreamCallbacks } from "../streamChatResponse.types.js";

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

  let currentStreamingItem: ChatHistoryItem | null = null;

  // Create callbacks to capture tool events
  const callbacks: StreamCallbacks = {
    onContent: (content: string) => {
      if (!currentStreamingItem) {
        currentStreamingItem = {
          message: { role: "assistant", content: "" },
          contextItems: [],
        };
        state.session.history.push(currentStreamingItem);
      }
      currentStreamingItem.message.content =
        (currentStreamingItem.message.content as string) + content;
    },
    onContentComplete: (content: string) => {
      if (currentStreamingItem) {
        currentStreamingItem.message.content = content;
        currentStreamingItem = null;
      } else {
        // Add complete assistant message
        state.session.history.push({
          message: { role: "assistant", content: content },
          contextItems: [],
        });
      }
    },
    onToolStart: (toolName: string, toolArgs?: any) => {
      // If there was streaming content, finalize it first
      if (currentStreamingItem && currentStreamingItem.message.content) {
        currentStreamingItem = null;
      }

      // Always create a new assistant message for each tool call
      const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      const toolCallState: ToolCallState = {
        toolCallId: toolCallId,
        toolCall: {
          id: toolCallId,
          type: "function",
          function: {
            name: toolName,
            arguments: JSON.stringify(toolArgs || {}),
          },
        },
        status: "calling",
        parsedArgs: toolArgs,
      };

      state.session.history.push({
        message: { role: "assistant", content: "" },
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
            return;
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
              return;
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
    ) => {
      // Set pending permission state
      state.pendingPermission = {
        toolName,
        toolArgs,
        requestId,
        timestamp: Date.now(),
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
    // Ensure any streaming message is finalized
    if (currentStreamingItem !== null) {
      currentStreamingItem = null;
    }
  }
}

export interface PendingPermission {
  toolName: string;
  toolArgs: any;
  requestId: string;
  timestamp: number;
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
