import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core/llm/types";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
} from "..";
import { RootStore } from "../../redux/store";
import { getFontSize } from "../../util";
import { logDevData } from "../../util/ide";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";

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
  const sessionHistory = useSelector((store: RootStore) => store.state.history);
  const active = useSelector((store: RootStore) => store.state.active);

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
    if (props.item.promptLogs?.length) {
      for (const [prompt, completion] of props.item.promptLogs) {
        logDevData("chat", { prompt, completion, feedback });
      }
    }
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
