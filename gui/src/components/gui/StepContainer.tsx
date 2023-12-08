import { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
} from "..";
import {
  ArrowPathIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import HeaderButtonWithText from "../HeaderButtonWithText";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import { getFontSize } from "../../util";
import { StepDescription } from "../../schema/SessionState";
import { useSelector } from "react-redux";
import { RootStore } from "../../redux/store";
import { GUIClientContext } from "../../App";
import { ChatHistoryItem } from "core/llm/types";

interface StepContainerProps {
  item: ChatHistoryItem;
  onReverse: () => void;
  onUserInput: (input: string) => void;
  onRetry: () => void;
  onDelete: () => void;
  open: boolean;
  isFirst: boolean;
  isLast: boolean;
  index: number;
  noUserInputParent: boolean;
}

// #region styled components

const ButtonsDiv = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
  background-color: ${vscBackground};
  box-shadow: 1px 1px 10px ${vscBackground};
  border-radius: ${defaultBorderRadius};
  z-index: 100;
  position: absolute;
  right: 8px;
  top: 16px;
  height: 0;
`;

const ContentDiv = styled.div<{ isUserInput: boolean; fontSize?: number }>`
  padding: 2px;
  padding-right: 0px;
  background-color: ${(props) =>
    props.isUserInput ? secondaryDark : vscBackground};
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

// #endregion

function StepContainer(props: StepContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const naturalLanguageInputRef = useRef<HTMLTextAreaElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const isUserInput = props.item.message.role === "user";
  const sessionHistory = useSelector(
    (store: RootStore) => store.sessionState.history
  );
  const active = useSelector((store: RootStore) => store.sessionState.active);
  const client = useContext(GUIClientContext);

  useEffect(() => {
    if (userInputRef?.current) {
      userInputRef.current.focus();
    }
  }, [userInputRef]);

  useEffect(() => {
    if (isHovered) {
      naturalLanguageInputRef.current?.focus();
    }
  }, [isHovered]);

  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    console.log(sessionHistory, props.index);
    const logs = sessionHistory[props.index].logs;
    if (!logs || logs.length < 1) return;
    const prompt = logs[0].split("#########\n")[1];
    const completion = props.item.message.content;

    console.log(prompt, completion, client);

    client?.sendPromptCompletionFeedback("chat", prompt, completion, feedback);
  };

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <div className="relative">
        {isHovered && (false || props.noUserInputParent) && (
          <ButtonsDiv>
            {false &&
              ((
                <HeaderButtonWithText
                  text="Retry"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRetry();
                  }}
                >
                  <ArrowPathIcon
                    width="1.4em"
                    height="1.4em"
                    onClick={props.onRetry}
                  />
                </HeaderButtonWithText>
              ) as any)}

            {props.noUserInputParent && (
              <HeaderButtonWithText
                text="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete();
                }}
              >
                <XMarkIcon
                  width="1.4em"
                  height="1.4em"
                  onClick={props.onRetry}
                />
              </HeaderButtonWithText>
            )}
          </ButtonsDiv>
        )}

        <ContentDiv
          hidden={!props.open}
          isUserInput={isUserInput}
          fontSize={getFontSize()}
        >
          <StyledMarkdownPreview source={props.item.message.content} />
        </ContentDiv>
        {(isHovered || typeof feedback !== "undefined") && !active && (
          <div className="flex items-center gap-2 bottom-0 right-2 absolute">
            {feedback === false || (
              <HandThumbUpIcon
                className={
                  "cursor-pointer hover:text-green-500" +
                  (feedback === true ? " text-green-500" : "")
                }
                width="1.2em"
                height="1.2em"
                color={lightGray}
                onClick={() => {
                  sendFeedback(true);
                }}
              />
            )}
            {feedback === true || (
              <HandThumbDownIcon
                className={
                  "cursor-pointer hover:text-red-500" +
                  (feedback === false ? " text-red-500" : "")
                }
                width="1.2em"
                height="1.2em"
                color={lightGray}
                onClick={() => {
                  sendFeedback(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StepContainer;
