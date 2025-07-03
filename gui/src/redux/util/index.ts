import { ContextItem, ToolCallState } from "core";
import { DataLogger } from "core/data/log";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { RootState } from "../store";

export function findCurrentToolCall(
  chatHistory: RootState["session"]["history"],
): ToolCallState | undefined {
  return chatHistory[chatHistory.length - 1]?.toolCallState;
}

// TODO parallel tool calls - find tool call must search within arrays
export function findToolCall(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ToolCallState | undefined {
  return chatHistory.find(
    (item) => item.toolCallState?.toolCallId === toolCallId,
  )?.toolCallState;
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
  finalOutput?: ContextItem[],
) {
  void DataLogger.getInstance().logDevData({
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
