import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { vscEditorBackground } from "..";
import HeaderButtonWithText from "../HeaderButtonWithText";

const TopDiv = styled.div`
  position: sticky;
  top: 0;
  left: 100%;
  height: 0;
  width: 0;
  overflow: visible;
`;

const SecondDiv = styled.div`
  position: absolute;
  top: -6px;
  right: -6px;
`;

interface CodeBlockToolBarProps {
  text: string;
}

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const [copied, setCopied] = useState(false);

  return (
    <TopDiv>
      <SecondDiv>
        <HeaderButtonWithText
          text={copied ? "Copied!" : "Copy"}
          style={{ backgroundColor: vscEditorBackground }}
          onClick={(e) => {
            navigator.clipboard.writeText(props.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <CheckIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ClipboardIcon className="w-4 h-4" />
          )}
        </HeaderButtonWithText>
      </SecondDiv>
    </TopDiv>
  );
}

export default CodeBlockToolBar;
