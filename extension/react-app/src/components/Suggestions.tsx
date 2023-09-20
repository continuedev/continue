import React, { useEffect, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  secondaryDark,
  vscForeground,
} from ".";
import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import HeaderButtonWithText from "./HeaderButtonWithText";

const Div = styled.div<{ isDisabled: boolean }>`
  border-radius: ${defaultBorderRadius};
  cursor: ${(props) => (props.isDisabled ? "auto" : "pointer")};
  padding: 8px 8px;
  position: relative;
  background-color: ${secondaryDark};
  border: 1px solid transparent;

  color: ${(props) => (props.isDisabled ? lightGray : vscForeground)};

  &:hover {
    border: ${(props) =>
      props.isDisabled ? "1px solid transparent" : `1px solid ${lightGray}`};
  }
`;

const P = styled.p`
  font-size: 13px;
  margin: 0;
  cursor: default;
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
    <Div
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
        className="absolute right-2 bottom-2"
        style={{
          opacity: isHovered ? 1 : 0,
          backgroundColor: secondaryDark,
          boxShadow: `1px 1px 10px ${secondaryDark}`,
          borderRadius: defaultBorderRadius,
        }}
      />
    </Div>
  );
}

const suggestionsStages: any[][] = [
  [
    {
      title: "Ask a question",
      description: "How does merge sort work?",
      textInput: "How does merge sort work?",
    },
    {
      title: "Ask a question",
      description: "How do I sum over a column in SQL?",
      textInput: "How do I sum over a column in SQL?",
    },
  ],
  [
    {
      title: "Highlight code, cmd+M, then ask a question",
      description: "Is there any way to make this code more efficient?",
      textInput: "Is there any way to make this code more efficient?",
    },
    {
      title: "Highlight code, cmd+M, then ask a question",
      description: "What does this function do?",
      textInput: "What does this function do?",
    },
  ],
  [
    {
      title: "Highlight code, cmd+shift+M, then request an edit",
      description: "/edit write comments for this code",
      textInput: "/edit write comments for this code",
    },
    {
      title: "Highlight code, cmd+shift+M, then request an edit",
      description: "/edit make this code more efficient",
      textInput: "/edit make this code more efficient",
    },
  ],
];

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

  return (
    <>
      {hide || timeline.some((node) => !node.step.hide) || stage >= 2 || (
        <div className="m-2 relative">
          <b className="ml-1">
            Tutorial:{" "}
            {stage < suggestionsStages.length &&
              suggestionsStages[stage][0]?.title}
          </b>
          <HeaderButtonWithText
            className="absolute right-1 top-0 cursor-pointer"
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
                  props.onClick(suggestion.textInput);
                  setStage(stage + 1);
                  localStorage.setItem("stage", (stage + 1).toString());
                  setHide(true);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default SuggestionsArea;
