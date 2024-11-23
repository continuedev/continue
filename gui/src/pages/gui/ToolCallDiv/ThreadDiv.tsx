import { ToolCall } from "core";
import { allTools } from "core/tools";
import styled from "styled-components";

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
  padding-bottom: 0;
`;

const ChildrenDiv = styled.div``;

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
            fontWeight: "bolder",
            marginTop: "1px",
          }}
        >
          {props.icon}
        </div>
        Continue wants to{" "}
        {
          allTools.find(
            (tool) => props.toolCall.function.name === tool.function.name,
          )?.wouldLikeTo
        }
      </HeaderDiv>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
