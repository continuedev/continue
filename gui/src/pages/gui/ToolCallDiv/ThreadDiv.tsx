import { Tool, ToolCallDelta, ToolCallState } from "core";
import Mustache from "mustache";
import styled from "styled-components";
import { useAppSelector } from "../../../redux/hooks";

interface ThreadDivProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  toolCall: ToolCallDelta;
  toolCallState: ToolCallState;
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
  const availableTools = useAppSelector((state) => state.config.config.tools);

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

  const tool = availableTools.find(
    (tool) => props.toolCall.function?.name === tool.function.name,
  );

  return (
    <Container>
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
        {tool?.faviconUrl && (
          <img src={tool.faviconUrl} className="h-4 w-4 rounded-sm" />
        )}
        Continue wants to {renderWouldLikeToMessage(tool, props.toolCallState)}
      </HeaderDiv>
      <ChildrenDiv>{props.children}</ChildrenDiv>
    </Container>
  );
}
