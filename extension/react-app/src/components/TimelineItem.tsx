import React from "react";
import { lightGray, vscBackground } from ".";
import styled from "styled-components";
import { ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import { getFontSize } from "../util";

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
        {props.historyNode.observation?.error
          ? props.historyNode.observation?.title
          : props.historyNode.step.name}
      </span>
    </CollapsedDiv>
  );
}

export default TimelineItem;
