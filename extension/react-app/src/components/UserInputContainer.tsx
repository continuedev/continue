import React, { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import { GUIClientContext } from "../App";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
  historyNode: HistoryNode;
  index: number;
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

const TextArea = styled.textarea`
  margin: 8px;
  margin-right: 22px;
  padding: 8px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Lexend", sans-serif;
  font-size: 13px;
  width: 100%;
  border-radius: ${defaultBorderRadius};
  height: 100%;
  border: none;
  background-color: ${vscBackground};
  resize: none;
  outline: none;
  border: none;
  color: ${vscForeground};

  &:focus {
    border: none;
    outline: none;
  }
`;

function stringWithEllipsis(str: string, maxLen: number) {
  if (str.length > maxLen) {
    return str.substring(0, maxLen - 3) + "...\n(Click to expand)";
  }
  return str;
}

const UserInputContainer = (props: UserInputContainerProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const client = useContext(GUIClientContext);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
      // Select all text
      textAreaRef.current.setSelectionRange(
        0,
        textAreaRef.current.value.length
      );
      // Change the size to match the contents (up to a max)
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height =
        (textAreaRef.current.scrollHeight > 500
          ? 500
          : textAreaRef.current.scrollHeight) + "px";
    }
  }, [isEditing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsEditing(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const doneEditing = (e: any) => {
    if (!textAreaRef.current?.value) {
      return;
    }
    client?.editStepAtIndex(textAreaRef.current.value, props.index);
    setIsEditing(false);
    e.stopPropagation();
  };

  return (
    <StyledDiv
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {isEditing ? (
        <TextArea
          ref={textAreaRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              doneEditing(e);
            }
          }}
          defaultValue={props.children}
          onBlur={() => {
            setIsEditing(false);
          }}
        />
      ) : (
        <StyledPre
          onClick={() => {
            setIsEditing(true);
          }}
          className="mr-6 cursor-text w-full"
        >
          {stringWithEllipsis(props.children, 600)}
        </StyledPre>
      )}
      {/* <ReactMarkdown children={props.children} className="w-fit mr-10" /> */}
      <DeleteButtonDiv>
        {(isHovered || isEditing) && (
          <div className="flex">
            {isEditing ? (
              <HeaderButtonWithText
                onClick={(e) => {
                  doneEditing(e);
                }}
                text="Done"
              >
                <CheckIcon width="1.4em" height="1.4em" />
              </HeaderButtonWithText>
            ) : (
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
          </div>
        )}
      </DeleteButtonDiv>
    </StyledDiv>
  );
};
export default UserInputContainer;
