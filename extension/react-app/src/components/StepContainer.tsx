import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
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
}

// #region styled components

const MainDiv = styled.div<{
  stepDepth: number;
  inFuture: boolean;
}>``;

const HeaderDiv = styled.div<{ error: boolean; loading: boolean }>`
  background-color: ${(props) => (props.error ? "#522" : vscBackground)};
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  padding-right: 8px;
`;

const OuterButtonsDiv = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  height: 0;
`;

const ButtonsDiv = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
  background-color: ${secondaryDark};
  border-radius: ${defaultBorderRadius};
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
        <HeaderDiv
          loading={(props.historyNode.active as boolean) || false}
          error={props.historyNode.observation?.error ? true : false}
        >
          {(isHovered || (props.historyNode.active as boolean)) && (
            <OuterButtonsDiv>
              <ButtonsDiv>
                {props.historyNode.observation?.error ? (
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
                ) : (
                  <></>
                )}
              </ButtonsDiv>
            </OuterButtonsDiv>
          )}
        </HeaderDiv>

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
