import React from "react";
import { lightGray, secondaryDark, vscBackground } from ".";
import styled from "styled-components";
import { PlusIcon } from "@heroicons/react/24/outline";

const CollapseButton = styled.div`
  border-radius: 50%;
  padding: 2px;
  width: 14px;
  height: 14px;
  background-color: ${vscBackground};
  border: 1px solid ${lightGray};
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  margin-left: 3px;

  &:hover {
    background-color: ${secondaryDark};
  }
`;

const CollapsedDiv = styled.div`
  margin-top: 8px;
  margin-bottom: 8px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
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
    <CollapsedDiv
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
    >
      <CollapseButton>
        {props.iconElement || <PlusIcon width="12px" height="12px" />}
      </CollapseButton>
      <span style={{ color: lightGray }}>{props.historyNode.step.name}</span>
    </CollapsedDiv>
  );
}

export default TimelineItem;
