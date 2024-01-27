import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import HeaderButtonWithText from "../HeaderButtonWithText";

const TopDiv = styled.div`
  padding: 4px 8px;

  position: absolute;
  top: 4px;
  right: 4px;

  display: flex;
`;

interface CodeBlockToolBarProps {
  text: string;
}

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const [copied, setCopied] = useState(false);

  return (
    <TopDiv>
      <HeaderButtonWithText
        text={copied ? "Copied!" : "Copy"}
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
    </TopDiv>
  );
}

export default CodeBlockToolBar;
