import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ArrowLeft, ArrowRight } from "@styled-icons/heroicons-outline";
import { defaultBorderRadius } from ".";
import Loader from "./Loader";

const StyledDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
  z-index: 200;

  color: white;
`;

const StyledSpan = styled.span`
  padding: 8px;
  border-radius: ${defaultBorderRadius};
  &:hover {
    background-color: #ffffff33;
  }
  white-space: nowrap;
`;

const Onboarding = () => {
  const [counter, setCounter] = useState(4);
  const gifs = ["intro", "highlight", "question", "help"];
  const topMessages = [
    "Welcome!",
    "Highlight code",
    "Ask a question",
    "Use /help to learn more",
  ];

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (hasVisited) {
      setCounter(0);
    } else {
      setCounter(0);
      localStorage.setItem("hasVisited", "true");
    }
  }, []);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [counter]);

  return (
    <StyledDiv hidden={counter >= 4}>
      <div
        style={{
          display: "grid",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          textAlign: "center",
          paddingLeft: "16px",
          paddingRight: "16px",
        }}
      >
        <h1>{topMessages[counter]}</h1>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {loading && (
            <div style={{ margin: "auto", position: "absolute", zIndex: 0 }}>
              <Loader />
            </div>
          )}
          {counter % 2 === 0 ? (
            <img
              src={`https://github.com/continuedev/continue/blob/main/media/${gifs[counter]}.gif?raw=true`}
              width="100%"
              key={"even-gif"}
              alt={topMessages[counter]}
              onLoad={() => {
                setLoading(false);
              }}
              style={{ zIndex: 1 }}
            />
          ) : (
            <img
              src={`https://github.com/continuedev/continue/blob/main/media/${gifs[counter]}.gif?raw=true`}
              width="100%"
              key={"odd-gif"}
              alt={topMessages[counter]}
              onLoad={() => {
                setLoading(false);
              }}
              style={{ zIndex: 1 }}
            />
          )}
        </div>
        <p
          style={{
            paddingLeft: "50px",
            paddingRight: "50px",
            paddingBottom: "50px",
            textAlign: "center",
            cursor: "pointer",
            whiteSpace: "nowrap",
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
            {counter === 0
              ? "Click to learn how to use Continue"
              : counter === 3
              ? "Get Started"
              : "Next"}{" "}
            <ArrowRight width="18px" strokeWidth="2px" />
          </StyledSpan>
        </p>
      </div>
    </StyledDiv>
  );
};

export default Onboarding;
