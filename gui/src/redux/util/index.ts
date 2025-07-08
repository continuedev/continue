import { ContextItem, ToolCallState } from "core";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { RootState } from "../store";

/**
 * Checks if there are any current tool calls in the most recent message.
 * 
 * @param chatHistory - The chat history array from Redux state
 * @returns True if there are any current tool calls, false otherwise
 */
export function hasCurrentToolCalls(
  chatHistory: RootState["session"]["history"],
): boolean {
  const lastItem = chatHistory[chatHistory.length - 1];
  if (!lastItem) {
    return false;
  }
  
  return !!lastItem.toolCallState || 
         (!!lastItem.toolCallStates && lastItem.toolCallStates.length > 0);
}

/**
 * Finds current tool calls with a specific status.
 * 
 * @param chatHistory - The chat history array from Redux state
 * @param status - The tool call status to filter by
 * @returns Array of tool call states with the specified status
 */
export function findCurrentToolCallsByStatus(
  chatHistory: RootState["session"]["history"],
  status: string,
): ToolCallState[] {
  return findCurrentToolCalls(chatHistory).filter(
    (toolCall) => toolCall.status === status
  );
}

/**
 * Finds all current tool calls from the most recent message in chat history.
 * 
 * @param chatHistory - The chat history array from Redux state
 * @returns An array of all current tool call states, or empty array if none found
 * 
 * @remarks
 * This function supports both single and multiple tool call scenarios.
 * For single tool calls, it returns an array with one element for consistency.
 */
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

/**
 * Finds a specific tool call by its ID anywhere in the chat history.
 * 
 * @param chatHistory - The chat history array from Redux state
 * @param toolCallId - The unique identifier of the tool call to find
 * @returns The tool call state with the matching ID, or undefined if not found
 * 
 * @remarks
 * This function searches both single tool call states and multiple tool call arrays.
 * It prioritizes single tool calls for backward compatibility, then searches
 * through all toolCallStates arrays in all messages.
 */
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
