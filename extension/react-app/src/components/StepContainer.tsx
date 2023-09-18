import { useContext, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscBackground,
} from ".";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { GUIClientContext } from "../App";
import StyledMarkdownPreview from "./StyledMarkdownPreview";

interface StepContainerProps {
  historyNode: HistoryNode;
  onReverse: () => void;
  inFuture: boolean;
  onUserInput: (input: string) => void;
  onRetry: () => void;
  onDelete: () => void;
  open: boolean;
  onToggleAll: () => void;
  onToggle: () => void;
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

const CollapseButton = styled.div`
  border-radius: 50%;
  padding: 2px;
  width: 14px;
  height: 14px;
  background-color: ${vscBackground};
  border: 1px solid ${lightGray};
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  margin-left: 3px;

  &:hover {
    background-color: ${secondaryDark};
  }
`;

const CollapsedDiv = styled.div`
  margin-top: 8px;
  margin-bottom: 8px;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
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

  return props.open ? (
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
          {props.open && false && (
            <pre className="overflow-x-scroll">
              Step Details:
              <br />
              {JSON.stringify(props.historyNode.step, null, 2)}
            </pre>
          )}

          {props.historyNode.observation?.error ? (
            <details>
              <summary>View Traceback</summary>
              <pre className="overflow-x-scroll">
                {props.historyNode.observation.error as string}
              </pre>
            </details>
          ) : (
            <StyledMarkdownPreview
              source={props.historyNode.step.description || ""}
              wrapperElement={{
                "data-color-mode": "dark",
              }}
            />
          )}
        </ContentDiv>
      </div>
    </MainDiv>
  ) : (
    <CollapsedDiv
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
    >
      <CollapseButton>
        <PlusIcon />
      </CollapseButton>
      <span style={{ color: lightGray }}>{props.historyNode.step.name}</span>
    </CollapsedDiv>
  );
}

export default StepContainer;
