import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { selectPendingToolCalls } from "../../../../redux/selectors/selectToolCalls";
import { callToolById } from "../../../../redux/thunks/callToolById";
import { cancelToolCallThunk } from "../../../../redux/thunks/cancelToolCall";
import { getAltKeyLabel, getMetaKeyLabel, isJetBrains } from "../../../../util";
import { Button } from "../../../ui";
import { useMainEditor } from "../../TipTapEditor";
import { AlwaysAllowButton } from "./AlwaysAllowButton";

export const generateToolCallButtonTestId = (
  action: "accept" | "reject",
  toolCallId: string,
) => {
  return `${action}-tool-call-button-${toolCallId}`;
};

export function PendingToolCallToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();
  const pendingToolCalls = useAppSelector(selectPendingToolCalls);
  const editor = useMainEditor();

  if (pendingToolCalls.length === 0) {
    return null;
  }

  const handleAccept = (toolCallId: string) => {
    void dispatch(callToolById({ toolCallId }));
  };

  const handleReject = (toolCallId: string) => {
    // put cursor in editor after last rejection
    if (pendingToolCalls.length === 1) {
      editor.mainEditor?.commands.focus();
    }
    void dispatch(cancelToolCallThunk({ toolCallId }));
  };

  return (
    <div className="flex w-full flex-col pb-0.5">
      {pendingToolCalls.map((toolCall, index) => (
        <div
          key={toolCall.toolCallId}
          className="flex items-center gap-2 rounded border border-input bg-input"
        >
          <span className="flex-1 truncate text-xs italic text-description">
            {toolCall.tool?.displayTitle ?? toolCall.toolCall.function.name}
          </span>
          {toolCall.policyNote && (
            <span
              className="max-w-56 truncate text-2xs text-warning"
              title={toolCall.policyNote}
              data-testid={`policy-note-${toolCall.toolCallId}`}
            >
              {toolCall.policyNote}
            </span>
          )}

          <div className="flex items-center gap-1">
            {!isJetBrains() && (
              <AlwaysAllowButton
                toolCallId={toolCall.toolCallId}
                toolName={toolCall.toolCall.function.name}
                parsedArgs={toolCall.parsedArgs}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="my-1 font-medium text-description-muted"
              onClick={() => handleReject(toolCall.toolCallId)}
              data-testid={generateToolCallButtonTestId(
                "reject",
                toolCall.toolCallId,
              )}
            >
              {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
              {index === 0 && (
                <span className="mr-1 text-2xs">
                  {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()}⌫
                </span>
              )}
              <span>Reject</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              className="my-1 font-medium"
              onClick={() => handleAccept(toolCall.toolCallId)}
              data-testid={generateToolCallButtonTestId(
                "accept",
                toolCall.toolCallId,
              )}
            >
              {index === 0 && (
                <span className="mr-1 text-2xs">{getMetaKeyLabel()}⏎</span>
              )}
              <span>Accept</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
