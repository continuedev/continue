import { Tool, ToolCall, ToolCallState } from "core";
import Mustache from "mustache";
import { useSelector } from "react-redux";
import styled from "styled-components";
import { RootState } from "../../../redux/store";

interface ThreadDivProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  toolCall: ToolCall;
  toolCallState: ToolCallState;
  reactKey: string;
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
  const availableTools = useSelector(
    (state: RootState) => state.state.config.tools,
  );

  function renderWouldLikeToMessage(
    tool: Tool | undefined,
    toolCallState: ToolCallState,
  ): string {
    if (!tool) return "";

    const rendered = Mustache.render(
      tool.wouldLikeTo,
      toolCallState.parsedArgs,
    );
    return rendered;
  }

  return (
    <Container key={props.reactKey}>
      <HeaderDiv>
        <div
          style={{
            width: `${W}px`,
            height: `${W}px`,
            fontWeight: "bolder",
            marginTop: "1px",
            flexShrink: 0,
          }}
        >
          {props.icon}
        </div>
        Continue wants to{" "}
        {renderWouldLikeToMessage(
          availableTools.find(
            (tool) => props.toolCall.function.name === tool.function.name,
          ),
          props.toolCallState,
        )}
      </HeaderDiv>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
