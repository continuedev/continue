import { ToolCall } from "core";
import { useContext, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
} from "../../../components";
import Spinner from "../../../components/markdown/StepContainerPreToolbar/Spinner";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { streamUpdate } from "../../../redux/slices/stateSlice";
import { CreateFile } from "./CreateFile";
import { RunTerminalCommand } from "./RunTerminalCommand";
import { ToolState } from "./types";

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;

  margin: 8px;
  overflow: hidden;
  border-left: 1px solid ${lightGray};
  margin-left: 16px;
  padding-left: 16px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
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

interface ToolCallDivProps {
  toolCall: ToolCall;
}

function incrementalParseJson(raw: string): [boolean, any] {
  try {
    return [true, JSON.parse(raw)];
  } catch (e) {
    return [false, {}];
  }
}

function FunctionSpecificToolCallDiv({
  toolCall,
  state,
}: {
  toolCall: ToolCall;
  state: ToolState;
}) {
  const [_, args] = incrementalParseJson(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile
          filepath={args.filepath}
          fileContents={args.contents}
          state={state}
        />
      );
    case "run_terminal_command":
      return <RunTerminalCommand command={args.command} state={state} />;
    default:
      return (
        <>
          <div>{toolCall.function.name}</div>
          {Object.entries(args)?.map(([key, value]) => (
            <div key={key}>
              {key}: {JSON.stringify(value)}
            </div>
          ))}
        </>
      );
  }
}

export function ToolCallDiv(props: ToolCallDivProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();

  const [state, setState] = useState<ToolState>("generating");

  useEffect(() => {
    if (props.toolCall.function.arguments.length === 0) {
      return;
    }

    const [done, _] = incrementalParseJson(props.toolCall.function.arguments);
    if (done) {
      setState("generated");
    }
  }, [props.toolCall.function.arguments]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        callTool();
      }
      if (e.key === "Backspace" && e.metaKey) {
        e.preventDefault();
        cancelTool();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function cancelTool() {
    setState("canceled");
  }

  async function callTool() {
    let setCallingState = true;

    const timer = setTimeout(() => {
      if (setCallingState) {
        setState("calling");
      }
    }, 800);

    const result = await ideMessenger.request("tools/call", {
      toolCall: props.toolCall,
    });

    setCallingState = false;
    clearTimeout(timer);

    if (result.status === "success") {
      dispatch(
        streamUpdate({
          role: "tool",
          content: JSON.stringify(result.content.result),
          toolCallId: props.toolCall.id,
        }),
      );
      setState("done");
    }
  }

  return (
    <Container>
      <FunctionSpecificToolCallDiv toolCall={props.toolCall} state={state} />
      <ButtonContainer>
        {state === "generating" ? (
          <div
            className="flex w-full items-center justify-center gap-4"
            style={{
              color: lightGray,
              minHeight: "40px",
            }}
          >
            Thinking...
            {/* <Spinner /> */}
          </div>
        ) : state === "generated" ? (
          <>
            <RejectButton onClick={cancelTool}>Cancel</RejectButton>
            <AcceptButton onClick={callTool}>Continue</AcceptButton>
          </>
        ) : state === "calling" ? (
          <div className="ml-auto flex items-center gap-4">
            Loading...
            <Spinner />
          </div>
        ) : null}
      </ButtonContainer>
    </Container>
  );
}
