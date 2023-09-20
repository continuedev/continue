import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import HeaderButtonWithText from "./HeaderButtonWithText";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

interface StepContainerProps {
  historyNode: HistoryNode;
  onReverse: () => void;
  inFuture: boolean;
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

const MainDiv = styled.div<{
  stepDepth: number;
  inFuture: boolean;
}>``;

const ButtonsDiv = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
  background-color: ${vscBackground};
  box-shadow: 1px 1px 10px ${vscBackground};
  border-radius: ${defaultBorderRadius};

  position: absolute;
  right: 0;
  top: 0;
  height: 0;
`;

const ContentDiv = styled.div<{ isUserInput: boolean }>`
  padding: 2px;
  padding-right: 0px;
  background-color: ${(props) =>
    props.isUserInput ? secondaryDark : vscBackground};
  font-size: 13px;
  border-radius: ${defaultBorderRadius};
  overflow: hidden;
`;

// #endregion

function StepContainer(props: StepContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const naturalLanguageInputRef = useRef<HTMLTextAreaElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const isUserInput = props.historyNode.step.name === "UserInputStep";

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

  return (
    <MainDiv
      stepDepth={(props.historyNode.depth as any) || 0}
      inFuture={props.inFuture}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      hidden={props.historyNode.step.hide as any}
    >
      <div>
        {isHovered &&
          (props.historyNode.observation?.error || props.noUserInputParent) && (
            <ButtonsDiv>
              {props.historyNode.observation?.error &&
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

        <ContentDiv hidden={!props.open} isUserInput={isUserInput}>
          <StyledMarkdownPreview
            source={props.historyNode.step.description || ""}
            wrapperElement={{
              "data-color-mode": "dark",
            }}
          />
        </ContentDiv>
      </div>
    </MainDiv>
  );
}

export default StepContainer;
