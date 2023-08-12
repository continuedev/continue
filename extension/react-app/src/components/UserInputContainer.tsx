import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";
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
  padding-top: 0px;
  padding-bottom: 0px;
`;

const DeleteButtonDiv = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
`;

const StyledPre = styled.pre`
  margin-right: 22px;
  margin-left: 8px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Lexend", sans-serif;
  font-size: 13px;
`;

const UserInputContainer = (props: UserInputContainerProps) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <StyledDiv
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {/* <StyledMarkdownPreview
        light={true}
        source={props.children}
        className="mr-6"
      /> */}
      <StyledPre className="mr-6">{props.children}</StyledPre>
      {/* <ReactMarkdown children={props.children} className="w-fit mr-10" /> */}
      <DeleteButtonDiv>
        {isHovered && (
          <HeaderButtonWithText
            onClick={(e) => {
              props.onDelete();
              e.stopPropagation();
            }}
            text="Delete"
          >
            <XMarkIcon width="1.4em" height="1.4em" />
          </HeaderButtonWithText>
        )}
      </DeleteButtonDiv>
    </StyledDiv>
  );
};
export default UserInputContainer;
