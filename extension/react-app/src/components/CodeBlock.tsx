import hljs from "highlight.js";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";

import { Clipboard, CheckCircle } from "@styled-icons/heroicons-outline";

import StyledCode from "./StyledCode";

const StyledPre = styled.pre`
  overflow-y: scroll;
  word-wrap: normal;
  border: 0.5px solid gray;
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};
  padding: 8px;
  padding-top: 14px;
  padding-bottom: 16px;
`;

const StyledCopyButton = styled.button<{ visible: boolean }>`
  /* position: relative; */
  float: right;
  border: none;
  background-color: transparent;
  cursor: pointer;
  padding: 0;
  /* margin: 4px; */
  margin-top: -6px;

  visibility: ${(props) => (props.visible ? "visible" : "hidden")};
`;

function CopyButton(props: { textToCopy: string; visible: boolean }) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [clicked, setClicked] = useState<boolean>(false);
  return (
    <>
      <StyledCopyButton
        onMouseEnter={() => {
          setHovered(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
        }}
        visible={clicked || props.visible}
        onClick={() => {
          navigator.clipboard.writeText(props.textToCopy);
          setClicked(true);
          setTimeout(() => {
            setClicked(false);
          }, 2000);
        }}
      >
        {clicked ? (
          <CheckCircle color="#00ff00" size="1.4em" />
        ) : (
          <Clipboard color={hovered ? "#00ff00" : "white"} size="1.4em" />
        )}
      </StyledCopyButton>
    </>
  );
}

function CodeBlock(props: { language?: string; children: string }) {
  useEffect(() => {
    hljs.highlightAll();
  }, [props.children]);
  const [hovered, setHovered] = useState<boolean>(false);

  return (
    <StyledPre
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      <CopyButton visible={hovered} textToCopy={props.children} />
      <StyledCode>{props.children}</StyledCode>
    </StyledPre>
  );
}

export default CodeBlock;
