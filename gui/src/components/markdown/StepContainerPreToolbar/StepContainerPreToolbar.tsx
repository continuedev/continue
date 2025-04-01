import {
  ArrowLeftEndOnRectangleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { debounce } from "lodash";
import { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppSelector } from "../../../redux/hooks";
import {
  selectDefaultModel,
  selectUIConfig,
} from "../../../redux/slices/configSlice";
import {
  selectApplyStateByStreamId,
  selectIsInEditMode,
} from "../../../redux/slices/sessionSlice";
import { getFontSize } from "../../../util";
import HeaderButtonWithToolTip from "../../gui/HeaderButtonWithToolTip";
import { childrenToText, isTerminalCodeBlock } from "../utils";
import ApplyActions from "./ApplyActions";
import CopyButton from "./CopyButton";
import FileInfo from "./FileInfo";
import GeneratingCodeLoader from "./GeneratingCodeLoader";
import RunInTerminalButton from "./RunInTerminalButton";

const TopDiv = styled.div`
  outline: 1px solid ${vscCommandCenterInactiveBorder};
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px !important;
  background-color: ${vscEditorBackground};
  min-width: 0;
`;

const ToolbarDiv = styled.div<{ isExpanded: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: inherit;
  font-size: ${getFontSize() - 2}px;
  padding: 4px 6px;
  margin: 0;
  border-bottom: ${({ isExpanded }) =>
    isExpanded ? `1px solid ${vscCommandCenterInactiveBorder}` : "inherit"};
`;

export interface StepContainerPreToolbarProps {
  codeBlockContent: string;
  language: string | null;
  relativeFilepath: string;
  isGeneratingCodeBlock: boolean;
  codeBlockIndex: number; // To track which codeblock we are applying
  range?: string;
  children: any;
  expanded?: boolean;
  hideApply?: boolean;
}

export default function StepContainerPreToolbar(
  props: StepContainerPreToolbarProps,
) {
  const ideMessenger = useContext(IdeMessengerContext);
  const streamIdRef = useRef<string>(uuidv4());
  const wasGeneratingRef = useRef(props.isGeneratingCodeBlock);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const [isExpanded, setIsExpanded] = useState(
    props.expanded ?? (isInEditMode ? false : true),
  );
  const [codeBlockContent, setCodeBlockContent] = useState("");
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  const nextCodeBlockIndex = useAppSelector(
    (state) => state.session.codeBlockApplyStates.curIndex,
  );

  const applyState = useAppSelector((state) =>
    selectApplyStateByStreamId(state, streamIdRef.current),
  );

  const uiConfig = useAppSelector(selectUIConfig);
  const isBottomToolbarPosition =
    uiConfig?.codeBlockToolbarPosition == "bottom";

  const toolTipPlacement = isBottomToolbarPosition ? "top" : "bottom";

  // This handles an edge case when the last node in the markdown syntax tree is a codeblock.
  // In this scenario, `isGeneratingCodeBlock` is never set to false since we determine if
  // we are done generating based on whether the next node in the tree is not a codeblock.
  // The tree parsing logic for Remark is defined on page load, so we can't access state
  // during the actual tree parsing.
  const isGeneratingCodeBlock = !isStreaming
    ? false
    : props.isGeneratingCodeBlock;

  const isNextCodeBlock = nextCodeBlockIndex === props.codeBlockIndex;
  const hasFileExtension = /\.[0-9a-z]+$/i.test(props.relativeFilepath);

  const defaultModel = useAppSelector(selectDefaultModel);

  async function onClickApply() {
    if (!defaultModel) {
      return;
    }

    let fileUri = await inferResolvedUriFromRelativePath(
      props.relativeFilepath,
      ideMessenger.ide,
    );

    ideMessenger.post("applyToFile", {
      streamId: streamIdRef.current,
      filepath: fileUri,
      text: codeBlockContent,
      curSelectedModelTitle: defaultModel.title,
    });
  }

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => onClickApply(),
    [isNextCodeBlock, codeBlockContent],
    !isNextCodeBlock,
  );

  useEffect(() => {
    if (codeBlockContent === "") {
      setCodeBlockContent(childrenToText(props.children.props.children));
    } else {
      const debouncedEffect = debounce(() => {
        setCodeBlockContent(childrenToText(props.children.props.children));
      }, 100);

      debouncedEffect();

      return () => {
        debouncedEffect.cancel();
      };
    }
  }, [props.children, codeBlockContent]);

  // Temporarily disabling auto apply for Edit mode
  // useEffect(() => {
  //   const hasCompletedGenerating =
  //     wasGeneratingRef.current && !isGeneratingCodeBlock;

  //   const shouldAutoApply = hasCompletedGenerating && isInEditMode;

  //   if (shouldAutoApply) {
  //     onClickApply();
  //   }

  //   wasGeneratingRef.current = isGeneratingCodeBlock;
  // }, [isGeneratingCodeBlock]);

  async function onClickAcceptApply() {
    const fileUri = await inferResolvedUriFromRelativePath(
      props.relativeFilepath,
      ideMessenger.ide,
    );
    ideMessenger.post("acceptDiff", {
      filepath: fileUri,
      streamId: streamIdRef.current,
    });
  }

  async function onClickRejectApply() {
    const fileUri = await inferResolvedUriFromRelativePath(
      props.relativeFilepath,
      ideMessenger.ide,
    );
    ideMessenger.post("rejectDiff", {
      filepath: fileUri,
      streamId: streamIdRef.current,
    });
  }

  function onClickExpand() {
    setIsExpanded(!isExpanded);
  }

  // We want until there is an extension in the filepath to avoid rendering
  // an incomplete filepath
  if (!hasFileExtension) {
    return props.children;
  }

  return (
    <TopDiv>
      <ToolbarDiv isExpanded={isExpanded} className="find-widget-skip">
        <div className="flex min-w-0 max-w-[45%] items-center">
          <ChevronDownIcon
            onClick={onClickExpand}
            className={`h-3.5 w-3.5 shrink-0 cursor-pointer text-gray-400 hover:brightness-125 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          <div className="w-full min-w-0">
            <FileInfo
              relativeFilepath={props.relativeFilepath}
              range={props.range}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 max-sm:gap-1.5">
          {isGeneratingCodeBlock && (
            <GeneratingCodeLoader
              showLineCount={!isExpanded}
              codeBlockContent={codeBlockContent}
            />
          )}

          {!isGeneratingCodeBlock && (
            <>
              <CopyButton text={props.codeBlockContent} />
              {props.hideApply ||
                (isTerminalCodeBlock(props.language, props.codeBlockContent) ? (
                  <RunInTerminalButton command={props.codeBlockContent} />
                ) : (
                  <ApplyActions
                    applyState={applyState}
                    onClickApply={onClickApply}
                    onClickAccept={onClickAcceptApply}
                    onClickReject={onClickRejectApply}
                  />
                ))}
              <HeaderButtonWithToolTip
                text="Insert at cursor"
                style={{ backgroundColor: vscEditorBackground }}
                onClick={() =>
                  ideMessenger.post("insertAtCursor", {
                    text: codeBlockContent,
                  })
                }
                tooltipPlacement={toolTipPlacement}
              >
                <ArrowLeftEndOnRectangleIcon className="h-4 w-4 text-gray-400" />
              </HeaderButtonWithToolTip>
            </>
          )}
        </div>
      </ToolbarDiv>

      {isExpanded && (
        <div
          className={`overflow-hidden overflow-y-auto ${
            isExpanded ? "opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {props.children}
        </div>
      )}
    </TopDiv>
  );
}
