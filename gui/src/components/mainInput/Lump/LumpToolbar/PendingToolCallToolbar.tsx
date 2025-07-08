import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { selectCurrentToolCallsByStatus } from "../../../../redux/selectors/selectCurrentToolCall";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { cancelToolCallById } from "../../../../redux/thunks/cancelToolCallById";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { EnterButton } from "../../InputToolbar/EnterButton";

export function PendingToolCallToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();
  const pendingToolCalls = useAppSelector((state) =>
    selectCurrentToolCallsByStatus(state, "generated"),
  );

  if (pendingToolCalls.length === 0) {
    return null;
  }

  const handleAccept = (toolCallId: string) => {
    void dispatch(callToolById({ toolCallId }));
  };

  const handleReject = (toolCallId: string) => {
    void dispatch(cancelToolCallById({ toolCallId }));
  };

  return (
    <div className="flex w-full flex-col gap-2 pb-0.5">
      {pendingToolCalls.map((toolCall) => (
        <div
          key={toolCall.toolCallId}
          className="border-input bg-input flex items-center gap-2 rounded border"
        >
          <span className="text-description flex-1 truncate text-xs italic">
            {toolCall.tool?.displayTitle ?? toolCall.toolCall.function.name}
          </span>

          <div className="flex gap-2">
            <div
              className="text-description cursor-pointer px-2 py-1 text-xs hover:brightness-125"
              onClick={() => handleReject(toolCall.toolCallId)}
              data-testid={`reject-tool-call-button-${toolCall.toolCallId}`}
            >
              {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
            </div>

            <EnterButton
              isPrimary={true}
              className="text-description text-xs hover:brightness-125"
              onClick={() => handleAccept(toolCall.toolCallId)}
              data-testid={`accept-tool-call-button-${toolCall.toolCallId}`}
            >
              {getMetaKeyLabel()} ⏎ Continue
            </EnterButton>
          </div>
        </div>
      ))}
    </div>
  );
}
