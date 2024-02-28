import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/countTokens";
import { useState } from "react";
import { useSelector } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscBackground,
  vscInputBackground,
} from "..";
import { RootState } from "../../redux/store";
import { getFontSize } from "../../util";
import { postToIde } from "../../util/ide";
import HeaderButtonWithText from "../HeaderButtonWithText";
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
    props.isUserInput ? vscInputBackground : vscBackground};
  font-size: ${(props) => props.fontSize || getFontSize()}px;
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

// #endregion

function StepContainer(props: StepContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isUserInput = props.item.message.role === "user";
  const active = useSelector((store: RootState) => store.state.active);

  const [feedback, setFeedback] = useState<boolean | undefined>(undefined);

  const sendFeedback = (feedback: boolean) => {
    setFeedback(feedback);
    if (props.item.promptLogs?.length) {
      for (const [prompt, completion] of props.item.promptLogs) {
        postToIde("devdata/log", {
          tableName: "chat",
          data: { prompt, completion, feedback },
        });
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
          <StyledMarkdownPreview
            source={stripImages(props.item.message.content)}
            showCodeBorder={true}
          />
        </ContentDiv>
        {(isHovered || typeof feedback !== "undefined") && !active && (
          <div
            className="flex items-center gap-2 right-2 absolute -bottom-3"
            style={{ zIndex: 200 }}
          >
            {feedback === false || (
              <HeaderButtonWithText text="Helpful">
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
              </HeaderButtonWithText>
            )}
            {feedback === true || (
              <HeaderButtonWithText text="Unhelpful">
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
              </HeaderButtonWithText>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StepContainer;
