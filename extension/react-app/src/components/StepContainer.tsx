import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import {
  appear,
  defaultBorderRadius,
  secondaryDark,
  vscBackground,
  GradientBorder,
  vscBackgroundTransparent,
} from ".";
import { RangeInFile, FileEdit } from "../../../src/client";
import CodeBlock from "./CodeBlock";
import SubContainer from "./SubContainer";

import {
  ChevronDown,
  ChevronRight,
  Backward,
  ArrowPath,
} from "@styled-icons/heroicons-outline";
import { HistoryNode } from "../../../schema/HistoryNode";
import ReactMarkdown from "react-markdown";
import ContinueButton from "./ContinueButton";
import InputAndButton from "./InputAndButton";
import ToggleErrorDiv from "./ToggleErrorDiv";

interface StepContainerProps {
  historyNode: HistoryNode;
  onReverse: () => void;
  inFuture: boolean;
  onRefinement: (input: string) => void;
  onUserInput: (input: string) => void;
  onRetry: () => void;
  open?: boolean;
}

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

const HeaderDiv = styled.div<{ error: boolean }>`
  background-color: ${(props) =>
    props.error ? "#522" : vscBackgroundTransparent};
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
`;

const ContentDiv = styled.div`
  padding: 8px;
  padding-left: 16px;
  background-color: ${vscBackground};
`;

const HeaderButton = styled.button`
  background-color: transparent;
  border: 1px solid white;
  border-radius: ${defaultBorderRadius};
  padding: 2px;
  cursor: pointer;
  color: white;

  &:hover {
    background-color: white;
    color: black;
  }
`;

const OnHoverDiv = styled.div`
  text-align: center;
  padding: 10px;
  animation: ${appear} 0.3s ease-in-out;
`;

function StepContainer(props: StepContainerProps) {
  const [open, setOpen] = useState(
    typeof props.open === "undefined" ? true : props.open
  );
  const [isHovered, setIsHovered] = useState(false);
  const naturalLanguageInputRef = useRef<HTMLTextAreaElement>(null);
  const userInputRef = useRef<HTMLInputElement>(null);

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

  const onTextInput = useCallback(() => {
    if (naturalLanguageInputRef.current) {
      props.onRefinement(naturalLanguageInputRef.current.value);
      naturalLanguageInputRef.current.value = "";
    }
  }, [naturalLanguageInputRef]);

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
      <StepContainerDiv open={open}>
        <GradientBorder
          borderColor={
            props.historyNode.observation?.error ? "#f00" : undefined
          }
          className="overflow-hidden cursor-pointer"
          onClick={() => setOpen((prev) => !prev)}
        >
          <HeaderDiv
            error={props.historyNode.observation?.error ? true : false}
          >
            <h4 className="m-2">
              {open ? (
                <ChevronDown size="1.4em" />
              ) : (
                <ChevronRight size="1.4em" />
              )}
              {props.historyNode.observation?.title ||
                (props.historyNode.step.name as any)}
            </h4>
            {/* <HeaderButton
              onClick={(e) => {
                e.stopPropagation();
                props.onReverse();
              }}
            >
              <Backward size="1.6em" onClick={props.onReverse}></Backward>
            </HeaderButton> */}

            {props.historyNode.observation?.error ? (
              <HeaderButton
                onClick={(e) => {
                  e.stopPropagation();
                  props.onRetry();
                }}
              >
                <ArrowPath size="1.6em" onClick={props.onRetry}></ArrowPath>
              </HeaderButton>
            ) : (
              <></>
            )}
          </HeaderDiv>
        </GradientBorder>
        <ContentDiv hidden={!open}>
          {open && false && (
            <>
              <pre className="overflow-scroll">
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
            <ReactMarkdown key={1} className="overflow-scroll">
              {props.historyNode.step.description as any}
            </ReactMarkdown>
          )}

          {/* {props.historyNode.step.name === "Waiting for user input" && (
            <InputAndButton
              onUserInput={(value) => {
                props.onUserInput(value);
              }}
            ></InputAndButton>
          )}
          {props.historyNode.step.name === "Waiting for user confirmation" && (
            <>
              <input
                type="button"
                value="Cancel"
                className="m-4 p-2 rounded-md border border-solid text-white border-gray-200 bg-vsc-background cursor-pointer hover:bg-white hover:text-black"
              ></input>
              <input
                className="m-4 p-2 rounded-md border border-solid text-white border-gray-200 bg-vsc-background cursor-pointer hover:bg-white hover:text-black"
                onClick={(e) => {
                  props.onUserInput("ok");
                  e.preventDefault();
                  e.stopPropagation();
                }}
                type="button"
                value="Confirm"
              />
            </>
          )} */}
        </ContentDiv>
      </StepContainerDiv>

      {/* <OnHoverDiv hidden={!open}>
        <NaturalLanguageInput
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onTextInput();
            }
          }}
          ref={naturalLanguageInputRef}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        ></NaturalLanguageInput>
        <ContinueButton onClick={onTextInput}></ContinueButton>
      </OnHoverDiv> */}
    </MainDiv>
  );
}

export default StepContainer;
