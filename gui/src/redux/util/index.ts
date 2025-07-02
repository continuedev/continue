import { ContextItem, ToolCallState } from "core";
import { safeParseToolCallArgs } from "core/tools/parseArgs";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { RootState } from "../store";

export function findCurrentToolCall(
  chatHistory: RootState["session"]["history"],
): ToolCallState | undefined {
  return chatHistory[chatHistory.length - 1]?.toolCallState;
}

export function findToolCall(
  chatHistory: RootState["session"]["history"],
  toolCallId: string,
): ToolCallState | undefined {
  return chatHistory.find(
    (item) => item.toolCallState?.toolCallId === toolCallId,
  )?.toolCallState;
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
      parsedArgs: toolCallState.parsedArgs,
      output: finalOutput || toolCallState.output || [],
      succeeded: success,
    },
  });
}
