import { ToolCall } from "core";
import styled from "styled-components";
import { FunctionSpecificHeader } from "./FunctionSpecificHeader";

interface ThreadDivProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  toolCall: ToolCall;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  padding: 8px;
`;

const ChildrenDiv = styled.div`
  margin: 8px;
  margin-left: 0;
`;

const W = 16;

const HeaderDiv = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
`;

export function ThreadDiv(props: ThreadDivProps) {
  return (
    <Container>
      <HeaderDiv>
        <div
          style={{
            width: `${W}px`,
            height: `${W}px`,
            fontWeight: "bold",
            marginTop: "1px",
          }}
        >
          {props.icon}
        </div>
        <FunctionSpecificHeader toolCall={props.toolCall} />
      </HeaderDiv>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
