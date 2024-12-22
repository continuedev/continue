import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
} from "../../../components";
import Spinner from "../../../components/gui/Spinner";
import { useAppDispatch } from "../../../redux/hooks";
import { selectCurrentToolCall } from "../../../redux/selectors/selectCurrentToolCall";
import { callTool } from "../../../redux/thunks/callTool";
import { cancelTool } from "../../../redux/thunks/cancelTool";

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  margin: 8px;
`;

const Button = styled.button`
  padding: 5px;
  border-radius: ${defaultBorderRadius};
  flex: 1;

  &:hover {
    cursor: pointer;
    opacity: 0.8;
  }
`;

const AcceptButton = styled(Button)`
  color: ${vscButtonForeground};
  border: none;
  background-color: ${vscButtonBackground};
  color: ${vscButtonForeground};

  &:hover {
    cursor: pointer;
  }
`;

const RejectButton = styled(Button)`
  color: ${lightGray};
  border: 1px solid ${lightGray};
  background-color: transparent;
`;

interface ToolCallButtonsProps {}

export function ToolCallButtons(props: ToolCallButtonsProps) {
  const dispatch = useAppDispatch();
  const toolCallState = useSelector(selectCurrentToolCall);

  if (!toolCallState) {
    return null;
  }

  return (
    <>
      <ButtonContainer>
        {toolCallState.status === "generating" ? (
          <div
            className="flex w-full items-center justify-center gap-4"
            style={{
              color: lightGray,
              minHeight: "40px",
            }}
          >
            Thinking...
          </div>
        ) : toolCallState.status === "generated" ? (
          <>
            <RejectButton onClick={() => dispatch(cancelTool())}>
              Cancel
            </RejectButton>
            <AcceptButton
              onClick={() => dispatch(callTool())}
              data-testid="accept-tool-call-button"
            >
              Continue
            </AcceptButton>
          </>
        ) : toolCallState.status === "calling" ? (
          <div className="ml-auto flex items-center gap-4">
            Loading...
            <Spinner />
          </div>
        ) : null}
      </ButtonContainer>
    </>
  );
}
