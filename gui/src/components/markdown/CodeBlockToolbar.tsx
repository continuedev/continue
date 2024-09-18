import {
  ArrowLeftEndOnRectangleIcon,
  CheckIcon,
  ClipboardIcon,
  PlayIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import {
  defaultBorderRadius,
  lightGray,
  vscEditorBackground,
  vscForeground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { incrementNextCodeBlockToApplyIndex } from "../../redux/slices/uiStateSlice";
import { getAltKeyLabel, getFontSize, isJetBrains } from "../../util";
import FileIcon from "../FileIcon";
import ButtonWithTooltip from "../ButtonWithTooltip";
import { CopyButton as CopyButtonHeader } from "./CopyButton";

const ToolbarDiv = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: inherit;
  font-size: ${getFontSize() - 2}px;
  padding: 3px;
  padding-left: 4px;
  padding-right: 4px;
  border-bottom: 0.5px solid ${lightGray}80;
  margin: 0;
`;

const ToolbarButton = styled.button`
  display: flex;
  align-items: center;
  border: none;
  outline: none;
  background: transparent;

  color: ${vscForeground};
  font-size: ${getFontSize() - 2}px;

  &:hover {
    cursor: pointer;
  }
`;

const HoverDiv = styled.div`
  position: sticky;
  top: 0;
  left: 100%;
  height: 0;
  width: 0;
  overflow: visible;
  z-index: 100;
`;

const InnerHoverDiv = styled.div<{ bottom: boolean }>`
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
  isNextCodeBlock: boolean;
  filename?: string;
}

const terminalLanguages = ["bash", "sh"];
const commonTerminalCommands = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "deno",
  "npx",
  "cd",
  "ls",
  "pwd",
  "pip",
  "python",
  "node",
  "git",
  "curl",
  "wget",
  "rbenv",
  "gem",
  "ruby",
  "bundle",
];

function isTerminalCodeBlock(language: string | undefined, text: string) {
  return (
    terminalLanguages.includes(language) ||
    ((!language || language?.length === 0) &&
      (text.trim().split("\n").length === 1 ||
        commonTerminalCommands.some((c) => text.trim().startsWith(c))))
  );
}

function getTerminalCommand(text: string): string {
  return text.startsWith("$ ") ? text.slice(2) : text;
}

function useApplyAction(text: string, isTerminal: boolean) {
  const [applying, setApplying] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  const handleApply = useCallback(() => {
    if (applying) return;

    if (isTerminal) {
      ideMessenger.ide.runCommand(getTerminalCommand(text));
    } else {
      ideMessenger.post("applyToCurrentFile", { text });
      setApplying(true);
      setTimeout(() => setApplying(false), 2000);
    }
  }, [applying, isTerminal, text, ideMessenger]);

  return { applying, handleApply };
}

function useCopyAction(text: string) {
  const [copied, setCopied] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);

  const handleCopy = useCallback(() => {
    if (isJetBrains()) {
      ideMessenger.request("copyText", { text });
    } else {
      navigator.clipboard.writeText(text);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, ideMessenger]);

  return { copied, handleCopy };
}

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();
  const isTerminal = isTerminalCodeBlock(props.language, props.text);
  const { applying, handleApply } = useApplyAction(props.text, isTerminal);
  const { copied, handleCopy } = useCopyAction(props.text);

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => {
      await ideMessenger.request("applyToCurrentFile", {
        text: props.text,
      });
      dispatch(incrementNextCodeBlockToApplyIndex({}));
    },
    [props.isNextCodeBlock, props.text],
    !props.isNextCodeBlock,
  );

  function onClickHeader() {
    // TODO: Need to turn into relative or fq path
    ideMessenger.post("showFile", {
      filepath: props.filename,
    });
  }

  if (!props.filename) {
    return (
      <HoverDiv>
        <InnerHoverDiv bottom={props.bottom || false}>
          {!isJetBrains() && isTerminal && (
            <ButtonWithTooltip
              text="Run in terminal"
              disabled={applying}
              style={{ backgroundColor: vscEditorBackground }}
              onClick={handleApply}
            >
              <CommandLineIcon className="w-4 h-4" />
            </ButtonWithTooltip>
          )}
          <ButtonWithTooltip
            text="Insert at cursor"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={() =>
              ideMessenger.post("insertAtCursor", { text: props.text })
            }
          >
            <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
          </ButtonWithTooltip>
          <CopyButtonHeader text={props.text} />
        </InnerHoverDiv>
      </HoverDiv>
    );
  }

  return (
    <ToolbarDiv>
      <div
        className="flex items-center cursor-pointer py-0.5 px-0.5"
        onClick={onClickHeader}
      >
        <FileIcon filename={props.filename} height="18px" width="18px" />
        <span className="hover:brightness-125 ml-1">{props.filename}</span>{" "}
      </div>

      <div className="flex items-center">
        <ToolbarButton onClick={handleCopy}>
          <div
            className="flex items-center gap-1 hover:brightness-125 transition-colors duration-200"
            style={{ color: lightGray }}
          >
            {copied ? (
              <>
                <CheckIcon className="w-3 h-3 text-green-500 hover:brightness-125" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <ClipboardIcon className="w-3 h-3 hover:brightness-125" />
                <span>Copy</span>
              </>
            )}
          </div>
        </ToolbarButton>

        {!isJetBrains() && (
          <ToolbarButton disabled={applying} onClick={handleApply}>
            <div
              className="flex items-center gap-1 hover:brightness-125 transition-colors duration-200"
              style={{ color: lightGray }}
            >
              {applying ? (
                <CheckIcon className="w-3 h-3 text-green-500" />
              ) : (
                <PlayIcon className="w-3 h-3" />
              )}
              <span>{applying ? "Applying..." : "Apply"}</span>
            </div>
          </ToolbarButton>
        )}
      </div>
    </ToolbarDiv>
  );
}

export default CodeBlockToolBar;
