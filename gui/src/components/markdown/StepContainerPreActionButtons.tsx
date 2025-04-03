import {
  ArrowLeftEndOnRectangleIcon,
  CommandLineIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { useContext, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppSelector } from "../../redux/hooks";
import {
  selectDefaultModel,
  selectUIConfig,
} from "../../redux/slices/configSlice";
import { isJetBrains } from "../../util";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { getTerminalCommand, isTerminalCodeBlock } from "./utils";

interface StepContainerPreActionButtonsProps {
  language: string | null;
  codeBlockContent: string;
  codeBlockIndex: number;
  children: any;
}

export default function StepContainerPreActionButtons({
  language,
  codeBlockContent,
  codeBlockIndex,
  children,
}: StepContainerPreActionButtonsProps) {
  const [hovering, setHovering] = useState(false);
  const ideMessenger = useContext(IdeMessengerContext);
  const uiConfig = useAppSelector(selectUIConfig);
  const streamIdRef = useRef<string | null>(null);
  const nextCodeBlockIndex = useAppSelector(
    (state) => state.session.codeBlockApplyStates.curIndex,
  );
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const isBottomToolbarPosition =
    uiConfig?.codeBlockToolbarPosition == "bottom";

  const toolTipPlacement = isBottomToolbarPosition ? "top" : "bottom";

  const shouldRunTerminalCmd =
    !isJetBrains() && isTerminalCodeBlock(language, codeBlockContent);
  const isNextCodeBlock = nextCodeBlockIndex === codeBlockIndex;

  if (streamIdRef.current === null) {
    streamIdRef.current = uuidv4();
  }

  const defaultModel = useAppSelector(selectDefaultModel);

  function onClickApply() {
    if (!defaultModel || !streamIdRef.current) {
      return;
    }
    ideMessenger.post("applyToFile", {
      streamId: streamIdRef.current,
      text: codeBlockContent,
      curSelectedModelTitle: defaultModel.title,
    });
  }

  async function onClickRunTerminal() {
    if (shouldRunTerminalCmd) {
      return await ideMessenger.ide.runCommandInWorkspace(
        getTerminalCommand(codeBlockContent),
        {
          preferVisibleTerminal: true,
        },
      );
    }
  }

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => onClickApply(),
    [isNextCodeBlock, codeBlockContent],
    !isNextCodeBlock,
  );

  return (
    <div
      tabIndex={-1}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="bg-vsc-editor-background relative my-2.5"
      style={{
        border: `1px solid ${vscCommandCenterInactiveBorder}`,
        borderRadius: defaultBorderRadius,
      }}
    >
      <div className="h-full w-full overflow-hidden rounded-md">{children}</div>
      {hovering && !isStreaming && (
        <div
          className="bg-vsc-editor-background z-100 absolute right-3 z-50 flex -translate-y-1/2 gap-1.5 px-1 py-0.5"
          style={{
            top: !isBottomToolbarPosition ? 0 : "100%",
            border: `1px solid ${vscCommandCenterInactiveBorder}`,
            borderRadius: defaultBorderRadius,
          }}
        >
          {shouldRunTerminalCmd && (
            <HeaderButtonWithToolTip
              text="Run in terminal"
              style={{ backgroundColor: vscEditorBackground }}
              onClick={onClickRunTerminal}
              tooltipPlacement={toolTipPlacement}
            >
              <CommandLineIcon className="h-4 w-4 text-gray-400" />
            </HeaderButtonWithToolTip>
          )}
          <HeaderButtonWithToolTip
            text="Apply"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={onClickApply}
            tooltipPlacement={toolTipPlacement}
          >
            <PlayIcon className="h-4 w-4 text-gray-400" />
          </HeaderButtonWithToolTip>
          <HeaderButtonWithToolTip
            text="Insert at cursor"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={() =>
              ideMessenger.post("insertAtCursor", { text: codeBlockContent })
            }
            tooltipPlacement={toolTipPlacement}
          >
            <ArrowLeftEndOnRectangleIcon className="h-4 w-4 text-gray-400" />
          </HeaderButtonWithToolTip>
          <CopyIconButton
            text={codeBlockContent}
            tooltipPlacement={toolTipPlacement}
          />
        </div>
      )}
    </div>
  );
}
