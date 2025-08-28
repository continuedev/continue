import type { ChatHistoryItem, ToolCallState, ToolStatus } from "core/index.js";

import { getCurrentSession, updateSessionTitle } from "../../session.js";

import { generateSessionTitle } from "./useChat.helpers.js";

interface CreateStreamCallbacksOptions {
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setActivePermissionRequest: React.Dispatch<React.SetStateAction<any>>;
  llmApi?: any;
  model?: any;
}

/**
 * Create stream callbacks for chat response
 */
export function createStreamCallbacks(
  options: CreateStreamCallbacksOptions,
): any {
  const { setChatHistory, setActivePermissionRequest, llmApi, model } = options;

  return {
    onContent: (_: string) => {},

    onContentComplete: async (content: string) => {
      setChatHistory((prev) => [
        ...prev,
        {
          contextItems: [],
          message: {
            role: "assistant",
            content: content,
            isStreaming: false,
          },
        },
      ]);

      // Generate session title after first assistant response
      if (content && llmApi && model) {
        const currentSession = getCurrentSession();
        const generatedTitle = await generateSessionTitle(
          content,
          llmApi,
          model,
          currentSession.title,
        );

        if (generatedTitle) {
          updateSessionTitle(generatedTitle);
        }
      }
    },

    onToolStart: (toolName: string, toolArgs?: any) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];

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

        newHistory.push({
          message: {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: toolCallId,
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(toolArgs || {}),
                },
              },
            ],
          },
          contextItems: [],
          toolCallStates: [toolCallState],
        });

        return newHistory;
      });
    },

    onToolResult: (result: string, toolName: string, status: ToolStatus) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];

        // Find the tool call state and update it
        for (let i = newHistory.length - 1; i >= 0; i--) {
          const item = newHistory[i];
          if (item.toolCallStates) {
            const toolState = item.toolCallStates.find(
              (ts) =>
                ts.toolCall.function.name === toolName &&
                ts.status === "calling",
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

        return newHistory;
      });
    },

    onToolError: (error: string, toolName?: string) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];

        // Find the tool call state and mark it as errored
        if (toolName) {
          for (let i = newHistory.length - 1; i >= 0; i--) {
            const item = newHistory[i];
            if (item.toolCallStates) {
              const toolState = item.toolCallStates.find(
                (ts) =>
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
        } else {
          // General error message
          newHistory.push({
            message: {
              role: "system",
              content: error,
            },
            contextItems: [],
          });
        }

        return newHistory;
      });
    },

    onToolPermissionRequest: (
      toolName: string,
      toolArgs: any,
      requestId: string,
      toolCallPreview?: any[],
    ) => {
      setActivePermissionRequest({
        toolName,
        toolArgs,
        requestId,
        toolCallPreview,
      });
    },

    onSystemMessage: (message: string) => {
      setChatHistory((prev) => [
        ...prev,
        {
          message: {
            role: "system",
            content: message,
          },
          contextItems: [],
        },
      ]);
    },
  };
}

interface ExecuteStreamingOptions {
  chatHistory: ChatHistoryItem[];
  model: any;
  llmApi: any;
  controller: AbortController;
  streamCallbacks: any;
  currentCompactionIndex: number | null;
}

/**
 * Execute streaming chat response
 */
export async function executeStreaming({
  chatHistory,
  model,
  llmApi,
  controller,
  streamCallbacks,
  currentCompactionIndex,
}: ExecuteStreamingOptions): Promise<void> {
  const { getHistoryForLLM } = await import("../../compaction.js");
  const { streamChatResponse } = await import(
    "../../stream/streamChatResponse.js"
  );

  if (model && llmApi) {
    if (
      currentCompactionIndex !== null &&
      currentCompactionIndex !== undefined
    ) {
      const historyForLLM = getHistoryForLLM(
        chatHistory,
        currentCompactionIndex,
      );
      const _originalLength = historyForLLM.length;

      await streamChatResponse(
        historyForLLM,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );

      // streamChatResponse modifies the array in place
      // The new messages are already in historyForLLM
    } else {
      await streamChatResponse(
        chatHistory,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );
    }
  }
}
