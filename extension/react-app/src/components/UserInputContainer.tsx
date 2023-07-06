import React from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import { buttonColor, secondaryDark } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { Play, XMark } from "@styled-icons/heroicons-outline";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";
import { HistoryNode } from "../../../schema/HistoryNode";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
  historyNode: HistoryNode;
}

const StyledDiv = styled.div`
  background-color: rgb(45 45 45);
  padding: 8px;
  padding-left: 16px;
  padding-right: 16px;
  border-bottom: 1px solid white;
  border-top: 1px solid white;
  font-size: 13px;
  display: flex;
  align-items: center;
`;

const UserInputContainer = (props: UserInputContainerProps) => {
  return (
    <StyledDiv>
      <b>{props.children}</b>
      <div style={{ marginLeft: "auto" }}>
        <HeaderButtonWithText
          onClick={(e) => {
            props.onDelete();
            e.stopPropagation();
          }}
          text="Delete"
        >
          <XMark size="1.6em" />
        </HeaderButtonWithText>
      </div>
    </StyledDiv>
  );
};

export default UserInputContainer;
