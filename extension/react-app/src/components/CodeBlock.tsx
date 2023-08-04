import hljs from "highlight.js";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, secondaryDark, vscBackground } from ".";

import { ClipboardIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

import StyledCode from "./StyledCode";

const StyledPre = styled.pre`
  overflow-y: scroll;
  word-wrap: normal;
  border: 0.5px solid gray;
  border-radius: ${defaultBorderRadius};
  background-color: ${secondaryDark};
  position: relative;
`;

const CopyButtonDiv = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
`;

const StyledCopyButton = styled.button<{ visible: boolean }>`
  border: none;
  background-color: transparent;
  cursor: pointer;

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
          <CheckCircleIcon color="#00ff00" width="1.4em" height="1.4em" />
        ) : (
          <ClipboardIcon
            color={hovered ? "#00ff00" : "white"}
            width="1.4em"
            height="1.4em"
          />
        )}
      </StyledCopyButton>
    </>
  );
}

function CodeBlock(props: { children: string; showCopy?: boolean }) {
  const [result, setResult] = useState<AutoHighlightResult | undefined>(
    undefined
  );

  const [highlightTimeout, setHighlightTimeout] = useState<
    NodeJS.Timeout | undefined
  >(undefined);

  useEffect(() => {
    // Don't highlight more than once every 100ms
    if (highlightTimeout) {
      return;
    }

    setHighlightTimeout(
      setTimeout(() => {
        const result = hljs.highlightAuto(props.children, [
          "python",
          "javascript",
          "typescript",
          "bash",
          "html",
          "css",
          "json",
          "yaml",
          "markdown",
          "sql",
          "java",
          "c",
          "cpp",
          "csharp",
          "go",
          "kotlin",
          "php",
          "ruby",
          "rust",
          "scala",
          "swift",
          "dart",
          "haskell",
          "perl",
          "r",
          "julia",
          "objectivec",
          "ocaml",
        ]);
        setResult(result);
        setHighlightTimeout(undefined);
      }, 100)
    );
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
      <CopyButtonDiv>
        <CopyButton
          visible={hovered && (props.showCopy || true)}
          textToCopy={props.children}
        />
      </CopyButtonDiv>
      <StyledCode language={result?.language}>{props.children}</StyledCode>
    </StyledPre>
  );
}

export default CodeBlock;
