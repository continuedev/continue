import React from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import { secondaryDark, vscBackground } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
  historyNode: HistoryNode;
}

const StyledDiv = styled.div`
  position: relative;
  background-color: ${secondaryDark};
  font-size: 13px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${vscBackground};
  padding: 8px;
`;

const DeleteButtonDiv = styled.div`
  position: absolute;
  top: 8px;
  right: 16px;
`;

const UserInputContainer = (props: UserInputContainerProps) => {
  return (
    <StyledDiv>
      <StyledMarkdownPreview
        light={true}
        source={props.children}
        className="mr-5"
      />
      {/* <ReactMarkdown children={props.children} className="w-fit mr-10" /> */}
      <DeleteButtonDiv>
        <HeaderButtonWithText
          onClick={(e) => {
            props.onDelete();
            e.stopPropagation();
          }}
          text="Delete"
        >
          <XMarkIcon width="1.4em" height="1.4em" />
        </HeaderButtonWithText>
      </DeleteButtonDiv>
    </StyledDiv>
  );
};
export default UserInputContainer;
