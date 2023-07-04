import React from "react";
import ReactMarkdown from "react-markdown";
import styled from "styled-components";
import { buttonColor, secondaryDark } from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { Play, XMark } from "@styled-icons/heroicons-outline";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
}

const StyledDiv = styled.div`
  background-color: rgb(50 50 50);
  padding: 8px;
  padding-left: 16px;
  border-bottom: 1px solid white;
  border-top: 1px solid white;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 2px;
`;

const DeleteButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
`;

const UserInputContainer: React.FC<UserInputContainerProps> = ({
  children,
  onDelete,
}) => {
  return (
    <StyledDiv>
      {children}
      <HeaderButtonWithText
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        text="Delete"
      >
        <XMark size="1.6em" onClick={onDelete} />
      </HeaderButtonWithText>
    </StyledDiv>
  );
};

export default UserInputContainer;
