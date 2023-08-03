import { useContext, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  appear,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscBackgroundTransparent,
  vscForeground,
} from ".";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import HeaderButtonWithText from "./HeaderButtonWithText";
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../util";
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

const MainDiv = styled.div<{ stepDepth: number; inFuture: boolean }>`
  opacity: ${(props) => (props.inFuture ? 0.3 : 1)};
  animation: ${appear} 0.3s ease-in-out;
  overflow: hidden;
  margin-left: 0px;
  margin-right: 0px;
`;

const StepContainerDiv = styled.div<{ open: boolean }>`
  /* background-color: ${(props) =>
    props.open ? vscBackground : secondaryDark}; */
  /* border-radius: ${defaultBorderRadius}; */
  /* padding: 8px; */
`;

const HeaderDiv = styled.div<{ error: boolean; loading: boolean }>`
  background-color: ${(props) => (props.error ? "#522" : vscBackground)};
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-gap: 8px;
  align-items: center;
  padding-right: 8px;
`;

const ContentDiv = styled.div<{ isUserInput: boolean }>`
  padding: 8px;
  background-color: ${(props) =>
    props.isUserInput ? secondaryDark : vscBackground};
  font-size: 13px;
`;

const gradient = keyframes`
  0% {
    background-position: 0px 0;
  }
  100% {
    background-position: 100em 0;
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
  padding-top: ${(props) =>
    `${(props.borderWidth || 1) / (props.isFirst ? 1 : 2)}px`};
  padding-bottom: ${(props) =>
    `${(props.borderWidth || 1) / (props.isLast ? 1 : 2)}px`};
  background: ${(props) =>
    props.borderColor
      ? props.borderColor
      : `repeating-linear-gradient(
    101.79deg,
    #12887a 0%,
    #87245c 16%,
    #e12637 33%,
    #ffb215 55%,
    #e12637 67%,
    #87245c 85%,
    #12887a 99%
  )`};
  animation: ${(props) => (props.loading ? gradient : "")} 6s linear infinite;
  background-size: 200% 200%;
`;

// #endregion

function StepContainer(props: StepContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const naturalLanguageInputRef = useRef<HTMLTextAreaElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);
  const isUserInput = props.historyNode.step.name === "UserInputStep";
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
      <StepContainerDiv open={props.open}>
        <GradientBorder
          loading={(props.historyNode.active as boolean) || false}
          isFirst={props.isFirst}
          isLast={props.isLast}
          borderColor={
            props.historyNode.observation?.error
              ? "#f00"
              : props.historyNode.active
              ? undefined
              : "transparent"
          }
          className="overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (isMetaEquivalentKeyPressed(e)) {
              props.onToggleAll();
            } else {
              props.onToggle();
            }
          }}
        >
          <HeaderDiv
            loading={(props.historyNode.active as boolean) || false}
            error={props.historyNode.observation?.error ? true : false}
          >
            <div className="m-2 flex items-center">
              {!isUserInput &&
                (props.open ? (
                  <ChevronDownIcon width="1.5em" height="1.5em" />
                ) : (
                  <ChevronRightIcon width="1.5em" height="1.5em" />
                ))}
              {props.historyNode.observation?.title ||
                (props.historyNode.step.name as any)}
            </div>
            {/* <HeaderButton
              onClick={(e) => {
                e.stopPropagation();
                props.onReverse();
              }}
            >
              <Backward size="1.6em" onClick={props.onReverse}></Backward>
            </HeaderButton> */}

            <>
              {(props.historyNode.logs as any)?.length > 0 && (
                <HeaderButtonWithText
                  text="Logs"
                  onClick={(e) => {
                    e.stopPropagation();
                    client?.showLogsAtIndex(props.index);
                  }}
                >
                  <MagnifyingGlassIcon width="1.5em" height="1.5em" />
                </HeaderButtonWithText>
              )}
              <HeaderButtonWithText
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete();
                }}
                text={
                  props.historyNode.active
                    ? `Stop (${getMetaKeyLabel()}⌫)`
                    : "Delete"
                }
              >
                {props.historyNode.active ? (
                  <StopCircleIcon
                    width="1.5em"
                    height="1.5em"
                    onClick={props.onDelete}
                  />
                ) : (
                  <XMarkIcon
                    width="1.5em"
                    height="1.5em"
                    onClick={props.onDelete}
                  />
                )}
              </HeaderButtonWithText>
              {props.historyNode.observation?.error ? (
                <HeaderButtonWithText
                  text="Retry"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onRetry();
                  }}
                >
                  <ArrowPathIcon
                    width="1.5em"
                    height="1.5em"
                    onClick={props.onRetry}
                  />
                </HeaderButtonWithText>
              ) : (
                <></>
              )}
            </>
          </HeaderDiv>
        </GradientBorder>
        <ContentDiv hidden={!props.open} isUserInput={isUserInput}>
          {props.open && false && (
            <>
              <pre className="overflow-x-scroll">
                Step Details:
                <br />
                {JSON.stringify(props.historyNode.step, null, 2)}
              </pre>
            </>
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
      </StepContainerDiv>
    </MainDiv>
  );
}

export default StepContainer;
