import {
  CheckIcon,
  ClipboardIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { postToIde } from "core/ide/messaging";
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
  z-index: 100;
`;

const SecondDiv = styled.div`
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  background-color: ${vscEditorBackground};
`;

interface CodeBlockToolBarProps {
  text: string;
}

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  return (
    <TopDiv>
      <SecondDiv>
        <HeaderButtonWithText
          text={applying ? "Applying..." : "Apply to current file"}
          disabled={applying}
          style={{ backgroundColor: vscEditorBackground }}
          onClick={(e) => {
            if (applying) return;
            postToIde("applyToCurrentFile", { text: props.text });
            setApplying(true);
            setTimeout(() => setApplying(false), 2000);
          }}
        >
          {applying ? (
            <CheckIcon className="w-4 h-4 text-green-500" />
          ) : (
            <PlayIcon className="w-4 h-4" />
          )}
        </HeaderButtonWithText>
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
