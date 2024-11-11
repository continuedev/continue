import { useContext, useRef, useState } from "react";
import styled from "styled-components";
import {
  CommandLineIcon,
  PlayIcon,
  ArrowLeftEndOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { defaultBorderRadius, vscEditorBackground } from "..";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { isJetBrains } from "../../util";
import { isTerminalCodeBlock } from "./utils";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { CopyIconButton } from "../gui/CopyIconButton";
import useUIConfig from "../../hooks/useUIConfig";
import { v4 as uuidv4 } from "uuid";
import { useApplyCodeBlock } from "./utils/useApplyCodeBlock";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";

const TopDiv = styled.div`
  outline: 0.5px solid rgba(153, 153, 152);
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px;
  background-color: ${vscEditorBackground};
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

const InnerHoverDiv = styled.div<{ isBottomToolbarPosition: boolean }>`
  position: absolute;
  ${(props) => (props.isBottomToolbarPosition ? "bottom: 3px;" : "top: -11px;")}
  right: 10px;
  display: flex;
  padding: 1px 2px;
  gap: 4px;
  border: 0.5px solid #8888;
  border-radius: ${defaultBorderRadius};
  background-color: ${vscEditorBackground};
`;

interface StepContainerPreActionButtonsProps {
  language: string;
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
  const uiConfig = useUIConfig();
  const streamIdRef = useRef<string | null>(null);
  const nextCodeBlockIndex = useSelector(
    (state: RootState) => state.uiState.nextCodeBlockToApplyIndex,
  );
  const onClickApply = useApplyCodeBlock({
    codeBlockContent,
    streamId: streamIdRef.current,
  });

  const isBottomToolbarPosition =
    uiConfig?.codeBlockToolbarPosition == "bottom";
  const shouldRunTerminalCmd =
    !isJetBrains() && isTerminalCodeBlock(language, codeBlockContent);
  const isNextCodeBlock = nextCodeBlockIndex === codeBlockIndex;

  if (streamIdRef.current === null) {
    streamIdRef.current = uuidv4();
  }

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    onClickApply,
    [isNextCodeBlock, codeBlockContent],
    !isNextCodeBlock,
  );

  if (!hovering) {
    return (
      <TopDiv
        tabIndex={-1}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {children}
      </TopDiv>
    );
  }

  return (
    <TopDiv
      tabIndex={-1}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <HoverDiv>
        <InnerHoverDiv isBottomToolbarPosition={isBottomToolbarPosition}>
          {shouldRunTerminalCmd && (
            <HeaderButtonWithToolTip
              text="Run in terminal"
              style={{ backgroundColor: vscEditorBackground }}
              onClick={onClickApply}
            >
              <CommandLineIcon className="h-4 w-4 text-gray-400" />
            </HeaderButtonWithToolTip>
          )}
          <HeaderButtonWithToolTip
            text="Apply"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={onClickApply}
          >
            <PlayIcon className="h-4 w-4 text-gray-400" />
          </HeaderButtonWithToolTip>
          <HeaderButtonWithToolTip
            text="Insert at cursor"
            style={{ backgroundColor: vscEditorBackground }}
            onClick={() =>
              ideMessenger.post("insertAtCursor", { text: codeBlockContent })
            }
          >
            <ArrowLeftEndOnRectangleIcon className="h-4 w-4 text-gray-400" />
          </HeaderButtonWithToolTip>
          <CopyIconButton text={codeBlockContent} />
        </InnerHoverDiv>
      </HoverDiv>
      {children}
    </TopDiv>
  );
}
