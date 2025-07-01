import { ContextItemWithId, ToolCallState } from "core";

export function toolCallStateToContextItems(
  toolCallState: ToolCallState | undefined,
): ContextItemWithId[] {
  if (!toolCallState) {
    return [];
  }
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
