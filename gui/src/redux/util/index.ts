import { ContextItem, ToolCallState } from "core";
import { safeParseToolCallArgs } from "core/tools/parseArgs";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { ChatHistoryItemWithMessageId } from "../slices/sessionSlice";
import { RootState } from "../store";

export function findCurrentToolCall(
  chatHistory: RootState["session"]["history"],
): ToolCallState | undefined {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const item = chatHistory[i];
    if (item.message.role !== "assistant") {
      break;
    }
    if (item.toolCallState) {
      return item.toolCallState;
    }
  }
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
  success: boolean,
  messenger: IIdeMessenger,
  finalOutput?: ContextItem[],
) {
  messenger.post("devdata/log", {
    name: "toolUsage",
    data: {
      toolCallId: toolCallState.toolCallId,
      functionName: toolCallState.toolCall?.function?.name,
      functionArgs: toolCallState.toolCall?.function?.arguments,
      toolCallArgs: safeParseToolCallArgs(toolCallState.toolCall),
      output: finalOutput || toolCallState.output || [],
      succeeded: success,
    },
  });
}
