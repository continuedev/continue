import React from "react";
import { lightGray, secondaryDark, vscBackground } from ".";
import styled from "styled-components";
import { ChatBubbleOvalLeftIcon, PlusIcon } from "@heroicons/react/24/outline";

const CollapseButton = styled.div`
  background-color: ${vscBackground};
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  flex-grow: 0;
  margin-left: 5px;
  cursor: pointer;
`;

const CollapsedDiv = styled.div`
  margin-top: 8px;
  margin-bottom: 8px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  min-height: 16px;
`;

interface TimelineItemProps {
  historyNode: any;
  open: boolean;
  onToggle: () => void;
  children: any;
  iconElement?: any;
}

function TimelineItem(props: TimelineItemProps) {
  return props.open ? (
    props.children
  ) : (
    <CollapsedDiv>
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
        {props.historyNode.observation?.error
          ? props.historyNode.observation?.title
          : props.historyNode.step.name}
      </span>
    </CollapsedDiv>
  );
}

export default TimelineItem;
