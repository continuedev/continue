import type { ChatHistoryItem, ToolCallState } from "../../../../../core/index.js";
import { convertFromUnifiedHistory } from "../../messageConversion.js";

interface CreateStreamCallbacksOptions {
  setChatHistory: React.Dispatch<React.SetStateAction<ChatHistoryItem[]>>;
  setActivePermissionRequest: React.Dispatch<React.SetStateAction<any>>;
}

/**
 * Create stream callbacks for chat response
 */
export function createStreamCallbacks(
  options: CreateStreamCallbacksOptions,
): any {
  const { setChatHistory, setActivePermissionRequest } = options;
  
  return {
    onContent: (_: string) => {},
    
    onContentComplete: (content: string) => {
      setChatHistory((prev) => [
          ...prev,
          {
            contextItems: [],
            message: {
              role: "assistant",
              content: content,
              isStreaming: false,
            }
          },
      ]);
    },
    
    onToolStart: (toolName: string, toolArgs?: any) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];
        
        // Always create a new assistant message for each tool call
        const toolCallState: ToolCallState = {
          toolCallId: `tool_${Date.now()}`,
          toolCall: {
            id: `tool_${Date.now()}`,
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
            toolCalls: [{
              id: toolCallState.toolCallId,
              type: "function",
              function: {
                name: toolName,
                arguments: JSON.stringify(toolArgs || {}),
              },
            }],
          },
          contextItems: [],
          toolCallStates: [toolCallState],
        });
        
        return newHistory;
      });
    },
    
    onToolResult: (result: string, toolName: string) => {
      setChatHistory((prev) => {
        const newHistory = [...prev];
        
        // Find the tool call state and update it
        for (let i = newHistory.length - 1; i >= 0; i--) {
          const item = newHistory[i];
          if (item.toolCallStates) {
            const toolState = item.toolCallStates.find(
              ts => ts.toolCall.function.name === toolName && ts.status === "calling"
            );
            
            if (toolState) {
              toolState.status = "done";
              toolState.output = [{
                content: result,
                name: `Tool Result: ${toolName}`,
                description: "Tool execution result",
              }];
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
                ts => ts.toolCall.function.name === toolName && ts.status === "calling"
              );
              
              if (toolState) {
                toolState.status = "errored";
                toolState.output = [{
                  content: error,
                  name: `Tool Error: ${toolName}`,
                  description: "Tool execution error",
                }];
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
  const { streamChatResponse } = await import("../../streamChatResponse.js");
  
  // Convert to legacy format for LLM
  const legacyHistory = convertFromUnifiedHistory(chatHistory);
  
  if (model && llmApi) {
    if (
      currentCompactionIndex !== null &&
      currentCompactionIndex !== undefined
    ) {
      const historyForLLM = getHistoryForLLM(
        legacyHistory,
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
      legacyHistory.push(...newMessages);
    } else {
      await streamChatResponse(
        legacyHistory,
        model,
        llmApi,
        controller,
        streamCallbacks,
      );
    }
  }
}