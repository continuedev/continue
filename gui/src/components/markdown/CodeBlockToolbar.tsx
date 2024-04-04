import {
  ArrowLeftEndOnRectangleIcon,
  CheckIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { defaultBorderRadius, vscEditorBackground } from "..";
import { isJetBrains, postToIde } from "../../util/ide";
import { WebviewIde } from "../../util/webviewIde";
import HeaderButtonWithText from "../HeaderButtonWithText";
import { CopyButton } from "./CopyButton";

const TopDiv = styled.div`
  position: sticky;
  top: 0;
  left: 100%;
  height: 0;
  width: 0;
  overflow: visible;
  z-index: 100;
`;

const SecondDiv = styled.div<{ bottom: boolean }>`
  position: absolute;
  ${(props) => (props.bottom ? "bottom: 3px;" : "top: -11px;")}
  right: 10px;
  display: flex;
  padding: 1px 2px;
  gap: 4px;
  border: 0.5px solid #8888;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscEditorBackground};
`;

interface CodeBlockToolBarProps {
  text: string;
  bottom: boolean;
  language: string | undefined;
}

const terminalLanguages = ["bash", "sh"];

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  return (
    <TopDiv>
      <SecondDiv bottom={props.bottom || false}>
        {isJetBrains() || (
          <>
            <HeaderButtonWithText
              text={
                terminalLanguages.includes(props.language)
                  ? "Run in terminal"
                  : applying
                  ? "Applying..."
                  : "Apply to current file"
              }
              disabled={applying}
              style={{ backgroundColor: vscEditorBackground }}
              onClick={() => {
                if (terminalLanguages.includes(props.language)) {
                  let text = props.text;
                  if (text.startsWith("$ ")) {
                    text = text.slice(2);
                  }
                  new WebviewIde().runCommand(text);
                }

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
              text="Insert at cursor"
              style={{ backgroundColor: vscEditorBackground }}
              onClick={() => {
                postToIde("insertAtCursor", { text: props.text });
              }}
            >
              <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
            </HeaderButtonWithText>
          </>
        )}

        <CopyButton text={props.text} />
      </SecondDiv>
    </TopDiv>
  );
}

export default CodeBlockToolBar;
