import hljs from "highlight.js";
import { useEffect } from "react";
import styled from "styled-components";
import { defaultBorderRadius, vscBackground } from ".";

import { Clipboard } from "@styled-icons/heroicons-outline";

const StyledPre = styled.pre`
  overflow: scroll;
  border: 1px solid gray;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscBackground};
`;

const StyledCode = styled.code`
  background-color: ${vscBackground};
`;

const StyledCopyButton = styled.button`
  float: right;
  border: none;
  background-color: ${vscBackground};
  cursor: pointer;
  padding: 0;
  margin: 4px;
  &:hover {
    color: #fff;
  }
`;

function CopyButton(props: { textToCopy: string }) {
  return (
    <>
      <StyledCopyButton
        onClick={() => {
          navigator.clipboard.writeText(props.textToCopy);
        }}
      >
        <Clipboard color="white" size="1.4em" />
      </StyledCopyButton>
    </>
  );
}

function CodeBlock(props: { language?: string; children: string }) {
  useEffect(() => {
    hljs.highlightAll();
  }, [props.children]);
  return (
    <StyledPre>
      <CopyButton textToCopy={props.children} />
      <StyledCode>{props.children}</StyledCode>
    </StyledPre>
  );
}

export default CodeBlock;
