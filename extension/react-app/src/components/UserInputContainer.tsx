import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styled, { keyframes } from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
  vscForeground,
} from ".";
import HeaderButtonWithText from "./HeaderButtonWithText";
import {
  XMarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import { GUIClientContext } from "../App";
import {
  getFontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../util";
import { RootStore } from "../redux/store";
import { useSelector } from "react-redux";

interface UserInputContainerProps {
  onDelete: () => void;
  children: string;
  index: number;
  onToggle: (arg0: boolean) => void;
  onToggleAll: (arg0: boolean) => void;
  isToggleOpen: boolean;
  active: boolean;
  groupIndices: number[];
}

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
  }
`;

const ToggleDiv = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  height: 100%;
  padding: 0 4px;

  &:hover {
    background-color: ${vscBackground};
  }
`;

const GradientBorder = styled.div<{
  borderWidth?: number;
  borderRadius?: string;
  borderColor?: string;
  isFirst: boolean;
  isLast: boolean;
  loading: boolean;
}>`
  border-radius: ${(props) => props.borderRadius || "0"};
  padding: ${(props) =>
    `${(props.borderWidth || 1) / (props.isFirst ? 1 : 2)}px`};
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
    101.79deg,
    #1BBE84 0%,
    #331BBE 16%,
    #BE1B55 33%,
    #A6BE1B 55%,
    #BE1B55 67%,
    #331BBE 85%,
    #1BBE84 99%
  )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
`;

const StyledDiv = styled.div<{ editing: boolean; fontSize?: number }>`
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  font-family: inherit;
  border-radius: ${defaultBorderRadius};
  height: auto;
  background-color: ${secondaryDark};
  color: ${vscForeground};
  align-items: center;
  position: relative;
  z-index: 1;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr auto;

  outline: ${(props) => (props.editing ? `1px solid ${lightGray}` : "none")};
  cursor: text;
`;

const DeleteButtonDiv = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: ${secondaryDark};
  box-shadow: 4px 4px 10px ${secondaryDark};
  border-radius: ${defaultBorderRadius};
`;

const GridDiv = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-gap: 8px;
  align-items: center;
  width: 100%;
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

  const divRef = useRef<HTMLDivElement>(null);
  const client = useContext(GUIClientContext);

  const [prevContent, setPrevContent] = useState("");

  const history = useSelector((state: RootStore) => state.serverState.history);

  useEffect(() => {
    if (isEditing && divRef.current) {
      setPrevContent(divRef.current.innerText);
      divRef.current.focus();

      if (divRef.current.innerText !== "") {
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(divRef.current, 0);
        range.setEnd(divRef.current, 1);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [isEditing, divRef.current]);

  const onBlur = useCallback(() => {
    setIsEditing(false);
    if (divRef.current) {
      divRef.current.innerText = prevContent;
      divRef.current.blur();
    }
  }, [divRef.current, prevContent]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBlur();
      }
    };
    divRef.current?.addEventListener("keydown", handleKeyDown);
    return () => {
      divRef.current?.removeEventListener("keydown", handleKeyDown);
    };
  }, [prevContent, divRef.current, isEditing, onBlur]);

  const doneEditing = (e: any) => {
    if (!divRef.current?.innerText) {
      return;
    }
    setPrevContent(divRef.current.innerText);
    client?.editStepAtIndex(divRef.current.innerText, props.index);
    setIsEditing(false);
    e.stopPropagation();
    divRef.current?.blur();
  };

  const [divTextContent, setDivTextContent] = useState("");

  const checkButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <GradientBorder
      loading={props.active}
      isFirst={false}
      isLast={false}
      borderColor={props.active ? undefined : vscBackground}
      borderRadius={defaultBorderRadius}
    >
      <StyledDiv
        fontSize={getFontSize()}
        editing={isEditing}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onClick={() => {
          setIsEditing(true);
        }}
      >
        <GridDiv>
          <ToggleDiv
            onClick={
              props.isToggleOpen
                ? (e) => {
                    e.stopPropagation();
                    if (isMetaEquivalentKeyPressed(e)) {
                      props.onToggleAll(false);
                    } else {
                      props.onToggle(false);
                    }
                  }
                : (e) => {
                    e.stopPropagation();
                    if (isMetaEquivalentKeyPressed(e)) {
                      props.onToggleAll(true);
                    } else {
                      props.onToggle(true);
                    }
                  }
            }
          >
            {props.isToggleOpen ? (
              <ChevronDownIcon width="1.4em" height="1.4em" />
            ) : (
              <ChevronRightIcon width="1.4em" height="1.4em" />
            )}
          </ToggleDiv>
          <div
            style={{
              padding: "8px",
              paddingTop: "4px",
              paddingBottom: "4px",
              width: "100%",
            }}
          >
            <div
              ref={divRef}
              onBlur={(e) => {
                if (e.relatedTarget !== checkButtonRef.current) onBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  doneEditing(e);
                }
              }}
              onInput={(e) => {
                setDivTextContent((e.target as any).innerText);
              }}
              contentEditable={true}
              suppressContentEditableWarning={true}
              className="mr-6 ml-1 cursor-text w-full py-2 flex items-center content-center outline-none"
            >
              {isEditing
                ? props.children
                : stringWithEllipsis(props.children, 600)}
            </div>
            <DeleteButtonDiv>
              {(isHovered || isEditing) && (
                <div className="flex">
                  {isEditing ? (
                    <HeaderButtonWithText
                      onClick={(e) => {
                        doneEditing(e);
                        e.stopPropagation();
                      }}
                      text="Done"
                      disabled={
                        divTextContent === "" || divTextContent === prevContent
                      }
                      ref={checkButtonRef}
                    >
                      <CheckIcon
                        width="1.4em"
                        height="1.4em"
                        color={
                          divTextContent === "" ||
                          divTextContent === prevContent
                            ? lightGray
                            : vscForeground
                        }
                      />
                    </HeaderButtonWithText>
                  ) : (
                    <>
                      {history.timeline
                        .filter(
                          (h, i: number) =>
                            props.groupIndices.includes(i) && h.logs
                        )
                        .some((h) => h.logs!.length > 0) && (
                        <HeaderButtonWithText
                          onClick={(e) => {
                            e.stopPropagation();
                            client?.showLogsAtIndex(props.groupIndices[1]);
                          }}
                          text="Context Used"
                        >
                          <MagnifyingGlassIcon width="1.4em" height="1.4em" />
                        </HeaderButtonWithText>
                      )}
                      <HeaderButtonWithText
                        onClick={(e) => {
                          e.stopPropagation();
                          if (props.active) {
                            client?.deleteAtIndex(props.groupIndices[1]);
                          } else {
                            props.onDelete();
                          }
                        }}
                        text={
                          props.active
                            ? `Stop (${getMetaKeyLabel()}⌫)`
                            : "Delete"
                        }
                      >
                        {props.active ? (
                          <StopCircleIcon width="1.4em" height="1.4em" />
                        ) : (
                          <XMarkIcon width="1.4em" height="1.4em" />
                        )}
                      </HeaderButtonWithText>
                    </>
                  )}
                </div>
              )}
            </DeleteButtonDiv>
          </div>
        </GridDiv>
      </StyledDiv>
    </GradientBorder>
  );
};
export default UserInputContainer;
