import { ContextItemWithId, ToolCallState } from "core";

export function toolCallStateToContextItems(
  toolCallState: ToolCallState,
): ContextItemWithId[] {
  return (
    toolCallState.output?.map((item) => ({
      ...item,
      id: {
        providerTitle: "toolCall",
        itemId: toolCallState.toolCallId,
      },
    })) ?? []
  );
}
