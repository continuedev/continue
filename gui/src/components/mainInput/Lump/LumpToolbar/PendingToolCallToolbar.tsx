import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { selectPendingToolCalls } from "../../../../redux/selectors/selectToolCalls";
import { cancelToolCall } from "../../../../redux/slices/sessionSlice";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { Button } from "../../../ui";

export function PendingToolCallToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();
  const pendingToolCalls = useAppSelector(selectPendingToolCalls);

  if (pendingToolCalls.length === 0) {
    return null;
  }

  const handleAccept = (toolCallId: string) => {
    void dispatch(callToolById({ toolCallId }));
  };

  const handleReject = (toolCallId: string) => {
    void dispatch(cancelToolCall({ toolCallId }));
  };

  return (
    <div className="flex w-full flex-col pb-0.5">
      {pendingToolCalls.map((toolCall, index) => (
        <div
          key={toolCall.toolCallId}
          className="border-input bg-input flex items-center gap-2 rounded border"
        >
          <span className="text-description flex-1 truncate text-xs italic">
            {toolCall.tool?.displayTitle ?? toolCall.toolCall.function.name}
          </span>

          <div className="flex items-center gap-2">
            {index === 0 && (
              <div
                className="text-description text-2xs cursor-pointer px-1.5 py-0.5 hover:brightness-125"
                onClick={() => handleReject(toolCall.toolCallId)}
                data-testid={`reject-tool-call-button-${toolCall.toolCallId}`}
              >
                {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
              </div>
            )}

            <Button
              variant="primary"
              size="sm"
              className="my-1 font-medium"
              onClick={() => handleAccept(toolCall.toolCallId)}
              data-testid={`accept-tool-call-button-${toolCall.toolCallId}`}
            >
              {index === 0 && (
                <code className="mr-1 text-[0.5625rem]">
                  {getMetaKeyLabel()} ⏎
                </code>
              )}
              <span>Accept</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
