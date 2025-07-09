import { ContextItem, ToolCallState, ToolStatus } from "core";
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

  return !!lastItem.toolCallStates && lastItem.toolCallStates.length > 0;
}

/**
 * Finds current tool calls with a specific status.
 *
 * @param chatHistory - The chat history array from Redux state
 * @param status - The tool call status to filter by
 * @returns Array of tool call states with the specified status
 */
export function findAllCurToolCallsByStatus(
  chatHistory: RootState["session"]["history"],
  status: ToolStatus,
): ToolCallState[] {
  return findAllCurToolCalls(chatHistory).filter(
    (toolCall) => toolCall.status === status,
  );
}

/**
 * Finds all current tool calls from the most recent message in chat history.
 *
 * @param chatHistory - The chat history array from Redux state
 * @returns An array of all current tool call states, or empty array if none found
 */
export function findAllCurToolCalls(
  chatHistory: RootState["session"]["history"],
): ToolCallState[] {
  const lastItem = chatHistory[chatHistory.length - 1];
  if (!lastItem) {
    return [];
  }

  return lastItem.toolCallStates || [];
}

/**
 * Finds a specific tool call by its ID anywhere in the chat history.
 *
 * @param chatHistory - The chat history array from Redux state
 * @param toolCallId - The unique identifier of the tool call to find
 * @returns The tool call state with the matching ID, or undefined if not found
 */
export function findToolCallById(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ToolCallState | undefined {
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

export function findToolOutputById(
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
