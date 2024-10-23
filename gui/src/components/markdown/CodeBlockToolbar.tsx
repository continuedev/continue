import {
  ArrowLeftEndOnRectangleIcon,
  CheckIcon,
  ClipboardIcon,
  CommandLineIcon,
  PlayIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getBasename } from "core/util";
import { useContext, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import {
  defaultBorderRadius,
  lightGray,
  vscEditorBackground,
  vscForeground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import {
  incrementNextCodeBlockToApplyIndex,
  updateApplyState,
} from "../../redux/slices/uiStateSlice";
import { RootState } from "../../redux/store";
import { getFontSize, getMetaKeyLabel, isJetBrains } from "../../util";
import ButtonWithTooltip from "../ButtonWithTooltip";
import FileIcon from "../FileIcon";
import { CopyButton as CopyButtonHeader } from "./CopyButton";
import { ToolbarButtonWithTooltip } from "./ToolbarButtonWithTooltip";

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

export const ToolbarButton = styled.button`
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
  filepath?: string;
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

function CodeBlockToolBar(props: CodeBlockToolBarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const dispatch = useDispatch();
  const isTerminal = isTerminalCodeBlock(props.language, props.text);
  const [isCopied, setIsCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const streamIdRef = useRef<string | null>(null);
  if (streamIdRef.current === null) {
    streamIdRef.current = uuidv4();
  }

  const applyState = useSelector(
    (store: RootState) =>
      store.uiState.applyStates.find(
        (state) => state.streamId === streamIdRef.current,
      )?.status ?? "closed",
  );

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => {
      await ideMessenger.request("applyToCurrentFile", {
        text: props.text,
        streamId: streamIdRef.current,
      });
      dispatch(incrementNextCodeBlockToApplyIndex({}));
    },
    [props.isNextCodeBlock, props.text],
    !props.isNextCodeBlock,
  );

  function onClickCopy() {
    if (isJetBrains()) {
      ideMessenger.request("copyText", { text: props.text });
    } else {
      navigator.clipboard.writeText(props.text);
    }

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  function onClickApply() {
    if (isApplying) return;

    if (isTerminal) {
      ideMessenger.ide.runCommand(getTerminalCommand(props.text));
    } else {
      ideMessenger.post("applyToCurrentFile", {
        text: props.text,
        streamId: streamIdRef.current,
      });
      dispatch(
        updateApplyState({
          streamId: streamIdRef.current,
          status: "streaming",
        }),
      );
    }
  }

  function onClickHeader() {
    // TODO: Need to turn into relative or fq path
    ideMessenger.post("showFile", {
      filepath: props.filepath,
    });
  }

  function onClickAccept() {
    ideMessenger.post("acceptDiff", { filepath: props.filepath });
    dispatch(
      updateApplyState({
        streamId: streamIdRef.current,
        status: "closed",
      }),
    );
  }

  function onClickReject() {
    ideMessenger.post("rejectDiff", { filepath: props.filepath });
    dispatch(
      updateApplyState({
        streamId: streamIdRef.current,
        status: "closed",
      }),
    );
  }

  if (!props.filepath) {
    return (
      <HoverDiv>
        <InnerHoverDiv bottom={props.bottom || false}>
          {!isJetBrains() && isTerminal && (
            <ButtonWithTooltip
              text="Run in terminal"
              disabled={isApplying}
              style={{ backgroundColor: vscEditorBackground }}
              onClick={onClickApply}
            >
              <CommandLineIcon className="h-4 w-4 text-gray-400" />
            </ButtonWithTooltip>
          )}
          <ButtonWithTooltip
            text={isApplying ? "Applying..." : "Apply"}
            style={{ backgroundColor: vscEditorBackground }}
            onClick={onClickApply}
          >
            {isApplying ? (
              <CheckIcon className="h-4 w-4 text-green-400" />
            ) : (
              <PlayIcon className="h-4 w-4 text-gray-400" />
            )}
          </ButtonWithTooltip>
          <ButtonWithTooltip
            text="Insert at cursor"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={() =>
              ideMessenger.post("insertAtCursor", { text: props.text })
            }
          >
            <ArrowLeftEndOnRectangleIcon className="h-4 w-4 text-gray-400" />
          </ButtonWithTooltip>
          <CopyButtonHeader text={props.text} />
        </InnerHoverDiv>
      </HoverDiv>
    );
  }

  return (
    <ToolbarDiv>
      <div
        className="flex max-w-[50%] cursor-pointer items-center gap-1"
        onClick={onClickHeader}
      >
        <FileIcon height="20px" width="20px" filename={props.filepath} />
        <span className="truncate">{getBasename(props.filepath)}</span>
      </div>

      <div className="flex items-center gap-1">
        <ToolbarButton onClick={onClickCopy}>
          <div
            className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
            style={{ color: lightGray }}
          >
            {isCopied ? (
              <>
                <CheckIcon className="h-3 w-3 text-green-500 hover:brightness-125" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <ClipboardIcon className="h-3 w-3 hover:brightness-125" />
                <span className="xs:inline hidden">Copy</span>
              </>
            )}
          </div>
        </ToolbarButton>

        {!isJetBrains() && (
          <div className="flex">
            {applyState === "closed" ? (
              <ToolbarButton
                onClick={onClickApply}
                style={{ color: lightGray }}
              >
                <div
                  className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125"
                  style={{ color: lightGray }}
                >
                  <PlayIcon className="h-3 w-3" />
                  <span className="xs:inline hidden">Apply</span>
                </div>
              </ToolbarButton>
            ) : applyState === "done" ? (
              <>
                <ToolbarButtonWithTooltip
                  onClick={onClickReject}
                  tooltipContent={`${getMetaKeyLabel()}⇧⌫`}
                >
                  <XMarkIcon className="mr-1 h-4 w-4 text-red-500 hover:brightness-125" />
                  <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
                    <span>Reject</span>
                  </div>
                </ToolbarButtonWithTooltip>

                <ToolbarButtonWithTooltip
                  onClick={onClickAccept}
                  tooltipContent={`${getMetaKeyLabel()}⇧⏎`}
                >
                  <CheckIcon className="mr-1 h-4 w-4 text-green-500 hover:brightness-125" />
                  <div className="flex items-center gap-1 transition-colors duration-200 hover:brightness-125">
                    <span>Accept</span>
                  </div>
                </ToolbarButtonWithTooltip>
              </>
            ) : (
              <div className="mr-2 flex items-center">
                <svg
                  className="h-4 w-4 animate-spin text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolbarDiv>
  );
}

export default CodeBlockToolBar;
