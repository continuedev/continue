import React from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import { buttonColor, secondaryDark, vscBackground } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import { HistoryNode } from "../../../schema/HistoryNode";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
  historyNode: HistoryNode;
}

const StyledDiv = styled.div`
  background-color: ${secondaryDark};
  padding: 8px;
  padding-left: 16px;
  padding-right: 16px;
  font-size: 13px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${vscBackground};
`;

const UserInputContainer = (props: UserInputContainerProps) => {
  return (
    <StyledDiv>
      {props.children}
      <div style={{ marginLeft: "auto" }}>
        <HeaderButtonWithText
          onClick={(e) => {
            props.onDelete();
            e.stopPropagation();
          }}
          text="Delete"
        >
          <XMarkIcon width="1.5em" height="1.5em" />
        </HeaderButtonWithText>
      </div>
    </StyledDiv>
  );
};

export default UserInputContainer;
