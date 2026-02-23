import type { ChatHistoryItem, ToolCallState, ToolStatus } from "core/index.js";

import { ALL_BUILT_IN_TOOLS } from "src/tools/allBuiltIns.js";
import { logger } from "src/util/logger.js";

import { services } from "../../services/index.js";
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
      // Do not add assistant messages via service; handleToolCalls is the single writer
      // For environments where the service isn't ready (unit tests), update local state only
      try {
        const svc = services.chatHistory;
        const useService = typeof svc?.isReady === "function" && svc.isReady();
        if (!useService && content) {
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
        }
      } catch (error) {
        logger.error("Failed to update chat history", { error });
      }
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
      // TODO service should always be ready, get rid of this code. If it's not ready throw error

      // When ChatHistoryService is ready, let handleToolCalls add entries
      const svc = services.chatHistory;
      const useService = typeof svc?.isReady === "function" && svc.isReady();
      if (useService) return;

      // Fallback (service not ready): create a local assistant message representing the tool call
      setChatHistory((prev) => {
        const newHistory = [...prev];

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
      // When service is ready, it updates tool results; avoid duplicate local updates
      const svc = services.chatHistory;
      const useService = typeof svc?.isReady === "function" && svc.isReady();
      if (useService) return;

      // Fallback (service not ready): update local UI-only state
      setChatHistory((prev) => {
        const newHistory = [...prev];

        for (let i = newHistory.length - 1; i >= 0; i--) {
          const item = newHistory[i];
          if (item.toolCallStates) {
            const toolState = item.toolCallStates.find(
              (ts) =>
                ts.toolCall.function.name === toolName &&
                (ts.status === "calling" || ts.status === "generated"),
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
      // When service is ready, handleToolCalls adds error entries; avoid duplicate local updates
      const svc = services.chatHistory;
      const useService = typeof svc?.isReady === "function" && svc.isReady();
      if (useService) return;

      setChatHistory((prev) => {
        const newHistory = [...prev];

        if (toolName) {
          for (let i = newHistory.length - 1; i >= 0; i--) {
            const item = newHistory[i];
            if (item.toolCallStates) {
              const toolState = item.toolCallStates.find(
                (ts) =>
                  ts.toolCall.function.name === toolName &&
                  (ts.status === "calling" || ts.status === "generated"),
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
      // Check if this tool has dynamic evaluation
      const tool = ALL_BUILT_IN_TOOLS.find((t: any) => t.name === toolName);
      const hasDynamicEvaluation = !!tool?.evaluateToolCallPolicy;

      setActivePermissionRequest({
        toolName,
        toolArgs,
        requestId,
        toolCallPreview,
        hasDynamicEvaluation,
      });
    },

    onSystemMessage: (message: string) => {
      try {
        const svc = services.chatHistory;
        if (typeof svc?.isReady === "function" && svc.isReady()) {
          svc.addSystemMessage(message);
          return;
        }
      } catch {}
      // Fallback to local state if service unavailable
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

      await streamChatResponse(
        historyForLLM,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );

      // Service-driven streaming; history updates occur via ChatHistoryService
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
