import { CheckIcon, PlayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import styled from "styled-components";
import { vscEditorBackground } from "..";
import { isJetBrains, postToIde } from "../../util/ide";
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
  ${(props) => (props.bottom ? "bottom: 1.2rem;" : "top: 4px;")}
  right: 4px;
  display: flex;
  gap: 4px;
  background-color: ${vscEditorBackground};
`;

interface CodeBlockToolBarProps {
  text: string;
  bottom: boolean;
}

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const [copied, setCopied] = useState(false);
  const [applying, setApplying] = useState(false);

  return (
    <TopDiv>
      <SecondDiv bottom={props.bottom || false}>
        {isJetBrains() || (
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
        )}
        <CopyButton text={props.text} />
      </SecondDiv>
    </TopDiv>
  );
}

export default CodeBlockToolBar;
