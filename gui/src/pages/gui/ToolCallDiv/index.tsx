import { ToolCall } from "core";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscButtonBackground,
  vscButtonForeground,
} from "../../../components";
import { CreateFile } from "./CreateFile";

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

function incrementalParseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function FunctionSpecificToolCallDiv(toolCall: ToolCall) {
  const args = incrementalParseJson(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "create_new_file":
      return (
        <CreateFile filepath={args.filepath} fileContents={args.contents} />
      );
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
  return (
    <Container>
      <FunctionSpecificToolCallDiv {...props.toolCall} />
      <ButtonContainer>
        <RejectButton>Cancel</RejectButton>
        <AcceptButton>Continue</AcceptButton>
      </ButtonContainer>
    </Container>
  );
}
