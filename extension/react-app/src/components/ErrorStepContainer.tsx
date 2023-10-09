import React from "react";
import styled from "styled-components";
import { HistoryNode } from "../../../schema/HistoryNode";
import { defaultBorderRadius, vscBackground } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import {
  MinusCircleIcon,
  MinusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const Div = styled.div`
  padding: 8px;
  background-color: #ff000011;
  border-radius: ${defaultBorderRadius};
  border: 1px solid #cc0000;
  margin: 8px;
`;

interface ErrorStepContainerProps {
  historyNode: HistoryNode;
  onClose: () => void;
  onDelete: () => void;
}

function ErrorStepContainer(props: ErrorStepContainerProps) {
  return (
    <div style={{ backgroundColor: vscBackground, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          right: "12px",
          top: "12px",
          display: "flex",
        }}
      >
        <HeaderButtonWithText text="Collapse" onClick={() => props.onClose()}>
          <MinusCircleIcon width="1.3em" height="1.3em" />
        </HeaderButtonWithText>
        <HeaderButtonWithText text="Collapse" onClick={() => props.onDelete()}>
          <XMarkIcon width="1.3em" height="1.3em" />
        </HeaderButtonWithText>
      </div>
      <Div>
        <pre style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
          {props.historyNode.observation?.error as string}
        </pre>
      </Div>
    </div>
  );
}

export default ErrorStepContainer;
