import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  appear,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  vscBackgroundTransparent,
} from ".";
import {
  ChevronDown,
  ChevronRight,
  ArrowPath,
  XMark,
} from "@styled-icons/heroicons-outline";
import { StopCircle } from "@styled-icons/heroicons-solid";
import { HistoryNode } from "../../../schema/HistoryNode";
import ReactMarkdown from "react-markdown";
import HeaderButtonWithText from "./HeaderButtonWithText";
import CodeBlock from "./CodeBlock";

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
}

// #region styled components

const MainDiv = styled.div<{ stepDepth: number; inFuture: boolean }>`
  opacity: ${(props) => (props.inFuture ? 0.3 : 1)};
  animation: ${appear} 0.3s ease-in-out;
  /* padding-left: ${(props) => props.stepDepth * 20}px; */
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
  background-color: ${(props) =>
    props.error
      ? "#522"
      : props.loading
      ? vscBackgroundTransparent
      : vscBackground};
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

const MarkdownPre = styled.pre`
  background-color: ${secondaryDark};
  padding: 10px;
  border-radius: ${defaultBorderRadius};
  border: 0.5px solid white;
`;

const StyledCode = styled.code`
  word-wrap: break-word;
  color: #f69292;
  background: transparent;
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
          loading={props.historyNode.active as boolean | false}
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
            if (e.metaKey) {
              props.onToggleAll();
            } else {
              props.onToggle();
            }
          }}
        >
          <HeaderDiv
            loading={props.historyNode.active as boolean | false}
            error={props.historyNode.observation?.error ? true : false}
          >
            <div className="m-2">
              {!isUserInput &&
                (props.open ? (
                  <ChevronDown size="1.4em" />
                ) : (
                  <ChevronRight size="1.4em" />
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
              <HeaderButtonWithText
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete();
                }}
                text={props.historyNode.active ? "Stop (⌘⌫)" : "Delete"}
              >
                {props.historyNode.active ? (
                  <StopCircle size="1.6em" onClick={props.onDelete} />
                ) : (
                  <XMark size="1.6em" onClick={props.onDelete} />
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
                  <ArrowPath size="1.6em" onClick={props.onRetry} />
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
            <pre className="overflow-x-scroll">
              {props.historyNode.observation.error as string}
            </pre>
          ) : (
            <ReactMarkdown
              key={1}
              className="overflow-x-scroll"
              components={{
                pre: ({ node, ...props }) => {
                  return (
                    <CodeBlock
                      children={(props.children[0] as any).props.children[0]}
                    />
                  );
                },
                code: ({ node, ...props }) => {
                  return <StyledCode children={props.children[0] as any} />;
                },
              }}
            >
              {props.historyNode.step.description as any}
            </ReactMarkdown>
          )}
        </ContentDiv>
      </StepContainerDiv>
    </MainDiv>
  );
}

export default StepContainer;
