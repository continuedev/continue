import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import {
  StyledTooltip,
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscForeground,
} from ".";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import HeaderButtonWithText from "./HeaderButtonWithText";

const Div = styled.div<{ isDisabled: boolean }>`
  border-radius: ${defaultBorderRadius};
  cursor: ${(props) => (props.isDisabled ? "not-allowed" : "pointer")};
  padding: 8px 8px;
  background-color: ${secondaryDark};
  border: 1px solid transparent;

  display: flex;
  justify-content: space-between;
  align-items: center;

  color: ${(props) => (props.isDisabled ? lightGray : vscForeground)};

  &:hover {
    border: ${(props) =>
      props.isDisabled ? "1px solid transparent" : `1px solid ${lightGray}`};
  }
`;

const P = styled.p`
  font-size: 13px;
  margin: 0;
`;

interface SuggestionsDivProps {
  title: string;
  description: string;
  textInput: string;
  onClick?: () => void;
  disabled: boolean;
}

function SuggestionsDiv(props: SuggestionsDivProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <Div
        data-tooltip-id={`suggestion-disabled-${props.textInput.replace(
          " ",
          ""
        )}`}
        onClick={props.onClick}
        onMouseEnter={() => {
          if (props.disabled) return;
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        isDisabled={props.disabled}
      >
        <P>{props.description}</P>
        <PaperAirplaneIcon
          width="1.6em"
          height="1.6em"
          style={{
            opacity: isHovered ? 1 : 0,
            backgroundColor: secondaryDark,
            boxShadow: `1px 1px 10px ${secondaryDark}`,
            borderRadius: defaultBorderRadius,
          }}
        />
      </Div>
      <StyledTooltip
        id={`suggestion-disabled-${props.textInput.replace(" ", "")}`}
        place="bottom"
        hidden={!props.disabled}
      >
        Must highlight code first
      </StyledTooltip>
    </>
  );
}

const stageDescriptions = [
  <p>Ask a question</p>,
  <ol>
    <li>Highlight code in the editor</li>
    <li>Press cmd+M to select the code</li>
    <li>Ask a question</li>
  </ol>,
  <ol>
    <li>Highlight code in the editor</li>
    <li>Press cmd+shift+M to select the code</li>
    <li>Request and edit</li>
  </ol>,
];

const suggestionsStages: any[][] = [
  [
    {
      title: stageDescriptions[0],
      description: "How does merge sort work?",
      textInput: "How does merge sort work?",
    },
    {
      title: stageDescriptions[0],
      description: "How do I sum over a column in SQL?",
      textInput: "How do I sum over a column in SQL?",
    },
  ],
  [
    {
      title: stageDescriptions[1],
      description: "Is there any way to make this code more efficient?",
      textInput: "Is there any way to make this code more efficient?",
    },
    {
      title: stageDescriptions[1],
      description: "What does this function do?",
      textInput: "What does this function do?",
    },
  ],
  [
    {
      title: stageDescriptions[2],
      description: "/edit write comments for this code",
      textInput: "/edit write comments for this code",
    },
    {
      title: stageDescriptions[2],
      description: "/edit make this code more efficient",
      textInput: "/edit make this code more efficient",
    },
  ],
];

const TutorialDiv = styled.div`
  margin: 4px;
  position: relative;
  background-color: #ff02;
  border-radius: ${defaultBorderRadius};
  padding: 8px 4px;
`;

function SuggestionsArea(props: { onClick: (textInput: string) => void }) {
  const [stage, setStage] = useState(
    parseInt(localStorage.getItem("stage") || "0")
  );
  const timeline = useSelector(
    (state: RootStore) => state.serverState.history.timeline
  );
  const sessionId = useSelector(
    (state: RootStore) => state.serverState.session_info?.session_id
  );
  const codeIsHighlighted = useSelector((state: RootStore) =>
    state.serverState.selected_context_items.some(
      (item) => item.description.id.provider_title === "code"
    )
  );

  const [hide, setHide] = useState(false);

  useEffect(() => {
    setHide(false);
  }, [sessionId]);

  const [numTutorialInputs, setNumTutorialInputs] = useState(0);

  const inputsAreOnlyTutorial = useCallback(() => {
    const inputs = timeline.filter(
      (node) => !node.step.hide && node.step.name === "User Input"
    );
    return inputs.length - numTutorialInputs === 0;
  }, [timeline, numTutorialInputs]);

  return (
    <>
      {hide || stage > 2 || !inputsAreOnlyTutorial() || (
        <TutorialDiv>
          <div className="flex">
            <SparklesIcon width="1.3em" height="1.3em" color="yellow" />
            <b className="ml-1">Tutorial</b>
          </div>
          <p style={{ color: lightGray }}>
            {stage < suggestionsStages.length &&
              suggestionsStages[stage][0]?.title}
          </p>
          <HeaderButtonWithText
            className="absolute right-1 top-1 cursor-pointer"
            text="Close Tutorial"
            onClick={() => {
              console.log("HIDE");
              setHide(true);
            }}
          >
            <XMarkIcon width="1.2em" height="1.2em" />
          </HeaderButtonWithText>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {suggestionsStages[stage]?.map((suggestion) => (
              <SuggestionsDiv
                disabled={stage > 0 && !codeIsHighlighted}
                {...suggestion}
                onClick={() => {
                  if (stage > 0 && !codeIsHighlighted) return;
                  props.onClick(suggestion.textInput);
                  setStage(stage + 1);
                  localStorage.setItem("stage", (stage + 1).toString());
                  setHide(true);
                  setNumTutorialInputs((prev) => prev + 1);
                }}
              />
            ))}
          </div>
        </TutorialDiv>
      )}
    </>
  );
}

export default SuggestionsArea;
