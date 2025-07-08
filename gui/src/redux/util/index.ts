import { ContextItem, ToolCallState } from "core";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { RootState } from "../store";

export function findCurrentToolCall(
  chatHistory: RootState["session"]["history"],
): ToolCallState | undefined {
  const lastItem = chatHistory[chatHistory.length - 1];
  if (!lastItem) {
    return undefined;
  }
  
  // Return single tool call state first (backward compatibility)
  if (lastItem.toolCallState) {
    return lastItem.toolCallState;
  }
  
  // Return first tool call from multiple tool calls
  if (lastItem.toolCallStates && lastItem.toolCallStates.length > 0) {
    return lastItem.toolCallStates[0];
  }
  
  return undefined;
}

// New function to get all current tool calls
export function findCurrentToolCalls(
  chatHistory: RootState["session"]["history"],
): ToolCallState[] {
  const lastItem = chatHistory[chatHistory.length - 1];
  if (!lastItem) {
    return [];
  }
  
  // Return single tool call state as array (backward compatibility)
  if (lastItem.toolCallState) {
    return [lastItem.toolCallState];
  }
  
  // Return multiple tool calls
  if (lastItem.toolCallStates) {
    return lastItem.toolCallStates;
  }
  
  return [];
}

// TODO parallel tool calls - find tool call must search within arrays
export function findToolCall(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ToolCallState | undefined {
  // Check single tool call state first (backward compatibility)
  const singleToolCall = chatHistory.find(
    (item) => item.toolCallState?.toolCallId === toolCallId,
  )?.toolCallState;
  
  if (singleToolCall) {
    return singleToolCall;
  }
  
  // Check multiple tool call states
  for (const item of chatHistory) {
    if (item.toolCallStates) {
      const toolCallState = item.toolCallStates.find(
        (state) => state.toolCallId === toolCallId,
      );
      if (toolCallState) {
        return toolCallState;
      }
    }
  }
  
  return undefined;
}

export function findToolOutput(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ChatHistoryItemWithMessageId | undefined {
  return chatHistory.find(
    (item) =>
      item.message.role === "tool" && item.message.toolCallId === toolCallId,
  );
}

export function logToolUsage(
  toolCallState: ToolCallState,
  accepted: boolean,
  success: boolean,
  messenger: IIdeMessenger,
  finalOutput?: ContextItem[],
) {
  messenger.post("devdata/log", {
    name: "toolUsage",
    data: {
      toolCallId: toolCallState.toolCallId,

      functionName:
        toolCallState.tool?.function?.name ||
        toolCallState.toolCall.function.name,

      functionParams: toolCallState.tool?.function.parameters,

      toolCallArgs: toolCallState.toolCall.function.arguments,
      accepted: accepted,
      output: finalOutput || toolCallState.output || [],
      succeeded: success,
    },
  });
}
