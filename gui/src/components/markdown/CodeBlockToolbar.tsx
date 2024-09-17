import {
  CheckIcon,
  ClipboardIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useContext, useState } from "react";
import { useDispatch } from "react-redux";
import styled from "styled-components";
import { lightGray, vscEditorBackground, vscForeground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { incrementNextCodeBlockToApplyIndex } from "../../redux/slices/uiStateSlice";
import { getFontSize, isJetBrains } from "../../util";
import FileIcon from "../FileIcon";

const ToolbarDiv = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${vscEditorBackground};
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

interface CodeBlockToolBarProps {
  text: string;
  bottom: boolean;
  language: string | undefined;
  isNextCodeBlock: boolean;
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

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [copied, setCopied] = useState<boolean>(false);
  const [applying, setApplying] = useState(false);
  const dispatch = useDispatch();

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

  return (
    <ToolbarDiv>
      <div
        className="flex items-center cursor-pointer"
        onClick={() => {
          // Open the file
        }}
      >
        <FileIcon
          filename={"test.py"}
          height={"16px"}
          width={"16px"}
        ></FileIcon>
        {props.language}
      </div>
      <div className="flex items-center">
        {isJetBrains() || (
          <ToolbarButton
            disabled={applying}
            style={{ backgroundColor: vscEditorBackground }}
            onClick={() => {
              if (isTerminalCodeBlock(props.language, props.text)) {
                let text = props.text;
                if (text.startsWith("$ ")) {
                  text = text.slice(2);
                }
                ideMessenger.ide.runCommand(text);
                return;
              }

              if (applying) return;
              ideMessenger.post("applyToCurrentFile", {
                text: props.text,
              });
              setApplying(true);
              setTimeout(() => setApplying(false), 2000);
            }}
          >
            <div
              className="flex items-center gap-1"
              style={{ color: lightGray }}
            >
              {applying ? (
                <CheckIcon className="w-3 h-3 text-green-500" />
              ) : (
                <PlayIcon className="w-3 h-3" />
              )}
              {isTerminalCodeBlock(props.language, props.text)
                ? "Run in terminal"
                : applying
                  ? "Applying..."
                  : "Apply"}
            </div>
          </ToolbarButton>
        )}
        {/* <ButtonWithTooltip
          text="Insert at cursor"
          style={{ backgroundColor: vscEditorBackground }}
          onClick={() => {
            ideMessenger.post("insertAtCursor", { text: props.text });
          }}
        >
          <ArrowLeftEndOnRectangleIcon className="w-4 h-4" />
        </ButtonWithTooltip> */}

        <ToolbarButton
          onClick={(e) => {
            const text =
              typeof props.text === "string" ? props.text : props.text;
            if (isJetBrains()) {
              ideMessenger.request("copyText", { text });
            } else {
              navigator.clipboard.writeText(text);
            }

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <CheckIcon className="w-3 h-3 text-green-500" />
          ) : (
            <ClipboardIcon className="w-3 h-3" color={lightGray} />
          )}
        </ToolbarButton>
      </div>
    </ToolbarDiv>
  );
}

export default CodeBlockToolBar;
