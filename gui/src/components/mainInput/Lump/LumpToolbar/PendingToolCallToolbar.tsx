import styled from "styled-components";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { selectCurrentToolCallsByStatus } from "../../../../redux/selectors/selectCurrentToolCall";
import { cancelToolCall } from "../../../../redux/slices/sessionSlice";
import { callToolById } from "../../../../redux/thunks/callToolById";
import {
  getAltKeyLabel,
  getFontSize,
  getMetaKeyLabel,
  isJetBrains,
} from "../../../../util";
import { EnterButton } from "../../InputToolbar/EnterButton";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StopButton = styled.div`
  font-size: ${getFontSize() - 3}px;
  padding: 2px;
  padding-right: 4px;
  cursor: pointer;
`;

export function PendingToolCallToolbar() {
  const dispatch = useAppDispatch();
  const jetbrains = isJetBrains();
  const pendingToolCalls = useAppSelector((state) => 
    selectCurrentToolCallsByStatus(state, "generated")
  );

  if (pendingToolCalls.length === 0) {
    return null;
  }

  const handleAccept = (toolCallId: string) => {
    dispatch(callToolById({ toolCallId }));
  };

  const handleReject = (toolCallId: string) => {
    dispatch(cancelToolCall({ toolCallId }));
  };

  return (
    <Container>
      <div className="text-description flex flex-row items-center pb-0.5 pr-1 text-xs">
        <span className="hidden sm:flex">
          {pendingToolCalls.length === 1 
            ? "Pending tool call" 
            : `${pendingToolCalls.length} pending tool calls`
          }
        </span>
      </div>

      <div className="flex flex-col gap-2 pb-0.5 w-full">
        {pendingToolCalls.map((toolCall) => (
          <div 
            key={toolCall.toolCallId}
            className="flex items-center gap-2 p-2 border border-input rounded bg-input"
          >
            <span className="text-foreground font-medium text-sm flex-1">
              {toolCall.toolCall.function.name}
            </span>
            
            <div className="flex gap-2">
              <StopButton
                className="text-description text-xs cursor-pointer px-2 py-1"
                onClick={() => handleReject(toolCall.toolCallId)}
                data-testid={`reject-tool-call-button-${toolCall.toolCallId}`}
              >
                {jetbrains ? getAltKeyLabel() : getMetaKeyLabel()} ⌫ Cancel
              </StopButton>
              
              <EnterButton
                isPrimary={true}
                className="text-description text-xs"
                onClick={() => handleAccept(toolCall.toolCallId)}
                data-testid={`accept-tool-call-button-${toolCall.toolCallId}`}
              >
                {getMetaKeyLabel()} ⏎ Continue
              </EnterButton>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
