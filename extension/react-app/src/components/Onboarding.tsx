import { useSelector } from "react-redux";
import { RootStore } from "../redux/store";
import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ArrowLeft, ArrowRight } from "@styled-icons/heroicons-outline";
import { defaultBorderRadius } from ".";

const StyledDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  z-index: 200;
`;

const StyledSpan = styled.span`
  padding: 8px;
  border-radius: ${defaultBorderRadius};
  &:hover {
    background-color: #ffffff33;
  }
`;

const Onboarding = () => {
  const [counter, setCounter] = useState(4);
  const gifs = ["intro", "explain", "edit", "generate"];
  const topMessages = [
    "Welcome to Continue!",
    "Answer coding questions",
    "Edit in natural language",
    "Generate files from scratch",
  ];
  const bottomMessages = [
    "",
    "Ask Continue about a part of your code to get another perspective",
    "Highlight a section of code and instruct Continue to refactor it",
    "Let Continue build the scaffolding of Python scripts, React components, and more",
  ];

  const vscMediaUrl = useSelector(
    (state: RootStore) => state.config.vscMediaUrl
  );

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (hasVisited) {
      setCounter(4);
    } else {
      setCounter(0);
      localStorage.setItem("hasVisited", "true");
    }
  }, []);

  return (
    <StyledDiv hidden={counter >= 4}>
      <div
        style={{
          display: "grid",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          textAlign: "center",
          background: `linear-gradient(
            101.79deg,
            #12887a66 0%,
            #87245c66 32%,
            #e1263766 63%,
            #ffb21566 100%
          )`,
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        <h1>{topMessages[counter]}</h1>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <img
            src={`${vscMediaUrl}/${gifs[counter]}.gif`}
            alt={topMessages[counter]}
          />
        </div>
        <p>{bottomMessages[counter]}</p>
        <p
          style={{
            paddingLeft: "50px",
            paddingRight: "50px",
            paddingBottom: "50px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              cursor: "pointer",
            }}
          >
            <StyledSpan
              hidden={counter === 0}
              onClick={() => setCounter((prev) => Math.max(prev - 1, 0))}
            >
              <ArrowLeft width="18px" strokeWidth="2px" /> Previous
            </StyledSpan>
            <span hidden={counter === 0}>{" | "}</span>
            <StyledSpan onClick={() => setCounter((prev) => prev + 1)}>
              Click to {counter === 3 || "learn how to"} use Continue{" "}
              <ArrowRight width="18px" strokeWidth="2px" />
            </StyledSpan>
          </div>
        </p>
      </div>
    </StyledDiv>
  );
};

export default Onboarding;
