import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
} from "../../../components";
import Spinner from "../../../components/markdown/StepContainerPreToolbar/Spinner";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import useChatHandler from "../../../hooks/useChatHandler";
import { selectCurrentToolCall } from "../../../redux/selectors/selectCurrentToolCall";
import { cancelToolCall } from "../../../redux/slices/stateSlice";

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
  const dispatch = useDispatch();
  const toolCallState = useSelector(selectCurrentToolCall);

  const ideMessenger = useContext(IdeMessengerContext);

  const { streamResponseAfterToolCall, callTool } = useChatHandler(
    dispatch,
    ideMessenger,
  );

  async function cancelTool() {
    dispatch(cancelToolCall());
    streamResponseAfterToolCall(toolCallState.toolCallId, [
      {
        name: "Cancelled",
        description: "Cancelled",
        content:
          "This tool call was cancelled by the user. You should try something else, likely just chatting instead of using another tool.",
      },
    ]);
  }

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
            <RejectButton onClick={cancelTool}>Cancel</RejectButton>
            <AcceptButton onClick={callTool}>Continue</AcceptButton>
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
