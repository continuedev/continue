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

const Container = styled.div`
  margin: 8px;
  overflow: hidden;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Button = styled.button`
  color: ${vscButtonForeground};
  padding: 6px;
  border-radius: ${defaultBorderRadius};
  flex: 1;

  &:hover {
    cursor: pointer;
    opacity: 0.8;
  }
`;

const AcceptButton = styled(Button)`
  border: none;
  background-color: ${vscButtonBackground};
  color: ${vscButtonForeground};

  &:hover {
    cursor: pointer;
  }
`;

const RejectButton = styled(Button)`
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

function FunctionSpecificToolCallDiv(toolCall: ToolCall) {
  const [_, args] = incrementalParseJson(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile filepath={args.filepath} fileContents={args.contents} />
      );
    case "run_terminal_command":
      return <RunTerminalCommand command={args.command} />;
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

  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (props.toolCall.function.arguments.length === 0) {
      return;
    }

    const [done, _] = incrementalParseJson(props.toolCall.function.arguments);
    if (done) {
      setLoading(false);
    }
  }, [props.toolCall.function.arguments]);

  async function callTool() {
    const result = await ideMessenger.request("tools/call", {
      toolCall: props.toolCall,
    });
    if (result.status === "success") {
      dispatch(
        streamUpdate({
          role: "tool",
          content: JSON.stringify(result.content.result),
        }),
      );
    }
  }

  return (
    <Container>
      <FunctionSpecificToolCallDiv {...props.toolCall} />
      <ButtonContainer>
        {loading ? (
          <div className="ml-auto flex items-center gap-4">
            Loading...
            <Spinner />
          </div>
        ) : (
          <>
            <RejectButton onClick={() => {}}>Cancel</RejectButton>
            <AcceptButton onClick={callTool}>Continue</AcceptButton>
          </>
        )}
      </ButtonContainer>
    </Container>
  );
}
