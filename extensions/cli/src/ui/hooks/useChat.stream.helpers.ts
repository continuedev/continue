import { ChatCompletionMessageParam } from "openai/resources.mjs";

import { formatToolCall } from "../../tools/index.js";
import { DisplayMessage } from "../types.js";

interface CreateStreamCallbacksOptions {
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setActivePermissionRequest: React.Dispatch<React.SetStateAction<any>>;
}

/**
 * Create stream callbacks for chat response
 */
export function createStreamCallbacks(
  options: CreateStreamCallbacksOptions,
  currentStreamingMessageRef: { current: any },
): any {
  const { setMessages, setActivePermissionRequest } = options;

  return {
    onContent: (content: string) => {
      if (!currentStreamingMessageRef.current) {
        currentStreamingMessageRef.current = {
          role: "assistant",
          content: "",
          isStreaming: true,
        };
      }
      currentStreamingMessageRef.current.content += content;
    },
    onContentComplete: (content: string) => {
      if (currentStreamingMessageRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: content,
            isStreaming: false,
          },
        ]);
        currentStreamingMessageRef.current = null;
      }
    },
    onToolStart: (toolName: string, toolArgs?: any) => {
      if (
        currentStreamingMessageRef.current &&
        currentStreamingMessageRef.current.content
      ) {
        const messageContent = currentStreamingMessageRef.current.content;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: messageContent,
            isStreaming: false,
          },
        ]);
        currentStreamingMessageRef.current = null;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: formatToolCall(toolName, toolArgs),
          messageType: "tool-start",
          toolName,
        },
      ]);
    },
    onToolResult: (result: string, toolName: string) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (
            newMessages[i].messageType === "tool-start" &&
            newMessages[i].toolName === toolName
          ) {
            newMessages[i] = {
              ...newMessages[i],
              messageType: "tool-result",
              toolResult: result,
            };
            break;
          }
        }
        return newMessages;
      });
    },
    onToolError: (error: string, toolName?: string) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: error,
          messageType: "tool-error",
          toolName,
        },
      ]);
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
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: message,
          messageType: "system" as const,
        },
      ]);
    },
  };
}

interface ExecuteStreamingOptions {
  newHistory: ChatCompletionMessageParam[];
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
  newHistory,
  model,
  llmApi,
  controller,
  streamCallbacks,
  currentCompactionIndex,
}: ExecuteStreamingOptions): Promise<void> {
  const { getHistoryForLLM } = await import("../../compaction.js");
  const { streamChatResponse } = await import("../../streamChatResponse.js");

  if (model && llmApi) {
    if (
      currentCompactionIndex !== null &&
      currentCompactionIndex !== undefined
    ) {
      const historyForLLM = getHistoryForLLM(
        newHistory,
        currentCompactionIndex,
      );
      const originalLength = historyForLLM.length;

      await streamChatResponse(
        historyForLLM,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );

      const newMessages = historyForLLM.slice(originalLength);
      newHistory.push(...newMessages);
    } else {
      await streamChatResponse(
        newHistory,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );
    }
  }
}
