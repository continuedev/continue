import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import styled from "styled-components";
import { lightGray, vscBackground } from "..";
import { getFontSize } from "../../util";

const CollapseButton = styled.div`
  background-color: ${vscBackground};
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  flex-grow: 0;
  margin-left: 13px;
  cursor: pointer;
`;

const CollapsedDiv = styled.div<{ fontSize?: number }>`
  margin-top: 8px;
  margin-bottom: 8px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  min-height: 16px;
`;

interface TimelineItemProps {
  item: ChatHistoryItem;
  open: boolean;
  onToggle: () => void;
  children: JSX.Element;
  iconElement?: JSX.Element;
}

function TimelineItem(props: TimelineItemProps) {
  return props.open ? (
    props.children
  ) : (
    <CollapsedDiv fontSize={getFontSize()}>
      <CollapseButton
        onClick={() => {
          props.onToggle();
        }}
      >
        {props.iconElement || (
          <ChatBubbleOvalLeftIcon width="16px" height="16px" />
        )}
      </CollapseButton>
      <span style={{ color: lightGray }}>
        {props.item.message.role} Message
        {/* {props.step.error ? props.step.error.title : props.step.name} */}
      </span>
    </CollapsedDiv>
  );
}

export default TimelineItem;
