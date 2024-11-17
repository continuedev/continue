import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { debounce } from "lodash";
import { useContext, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import styled, { css, keyframes } from "styled-components";
import { v4 as uuidv4 } from "uuid";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { updateApplyState } from "../../../redux/slices/uiStateSlice";
import { RootState } from "../../../redux/store";
import { getFontSize } from "../../../util";
import { childrenToText } from "../utils";
import { useApplyCodeBlock } from "../utils/useApplyCodeBlock";
import ApplyActions from "./ApplyActions";
import CopyButton from "./CopyButton";
import FileInfo from "./FileInfo";
import GeneratingCodeLoader from "./GeneratingCodeLoader";

const fadeInAnimation = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const TopDiv = styled.div<{ active?: boolean }>`
  outline: 1px solid rgba(153, 153, 152);
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px !important;
  background-color: ${vscEditorBackground};
  ${(props) =>
    props.active
      ? "animation: none;"
      : css`
          animation: ${fadeInAnimation} 300ms ease-out forwards;
        `}
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
    isExpanded ? `0.5px solid ${lightGray}80` : "inherit"};
`;

export interface StepContainerPreToolbarProps {
  codeBlockContent: string;
  language: string;
  filepath: string;
  isGeneratingCodeBlock: boolean;
  codeBlockIndex: number; // To track which codeblock we are applying
  range?: string;
  children: any;
}

export default function StepContainerPreToolbar(
  props: StepContainerPreToolbarProps,
) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const streamIdRef = useRef<string | null>(null);
  const wasGeneratingRef = useRef(props.isGeneratingCodeBlock);
  const isMultifileEdit = useSelector(
    (state: RootState) => state.state.isInMultifileEdit,
  );
  const active = useSelector((state: RootState) => state.state.active);
  const [isExpanded, setIsExpanded] = useState(isMultifileEdit ? false : true);
  const [codeBlockContent, setCodeBlockContent] = useState("");
  const isChatActive = useSelector((state: RootState) => state.state.active);
  const onClickApply = useApplyCodeBlock({
    streamId: streamIdRef.current,
    filepath: props.filepath,
    codeBlockContent: props.codeBlockContent,
  });
  const nextCodeBlockIndex = useSelector(
    (state: RootState) => state.uiState.nextCodeBlockToApplyIndex,
  );

  const applyState = useSelector((store: RootState) =>
    store.uiState.applyStates.find(
      (state) => state.streamId === streamIdRef.current,
    ),
  );

  // This handles an edge case when the last node in the markdown syntax tree is a codeblock.
  // In this scenario, `isGeneratingCodeBlock` is never set to false since we determine if
  // we are done generating based on whether the next node in the tree is not a codeblock.
  // The tree parsing logic for Remark is defined on page load, so we can't access state
  // during the actual tree parsing.
  const isGeneratingCodeBlock = !isChatActive
    ? false
    : props.isGeneratingCodeBlock;

  const isNextCodeBlock = nextCodeBlockIndex === props.codeBlockIndex;
  const hasFileExtension = /\.[0-9a-z]+$/i.test(props.filepath);

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

  useEffect(() => {
    const hasCompletedGenerating =
      wasGeneratingRef.current && !isGeneratingCodeBlock;
    const shouldAutoApply = hasCompletedGenerating && isMultifileEdit;

    if (shouldAutoApply) {
      onClickApply();
    }

    wasGeneratingRef.current = isGeneratingCodeBlock;
  }, [isGeneratingCodeBlock]);

  function onClickAcceptApply() {
    ideMessenger.post("acceptDiff", { filepath: props.filepath });
    dispatch(
      updateApplyState({
        streamId: streamIdRef.current,
        status: "closed",
      }),
    );
  }

  function onClickRejectApply() {
    ideMessenger.post("rejectDiff", { filepath: props.filepath });
    dispatch(
      updateApplyState({
        streamId: streamIdRef.current,
        status: "closed",
      }),
    );
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
    <TopDiv active={active}>
      <ToolbarDiv isExpanded={isExpanded} className="find-widget-skip">
        <div className="flex items-center">
          <ChevronDownIcon
            onClick={onClickExpand}
            className={`h-4 w-4 cursor-pointer text-gray-400 hover:bg-gray-800 hover:brightness-125 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          <FileInfo filepath={props.filepath} range={props.range} />
        </div>

        <div className="flex items-center gap-3">
          {isGeneratingCodeBlock && (
            <GeneratingCodeLoader
              showLineCount={!isExpanded}
              codeBlockContent={codeBlockContent}
            />
          )}

          {!isGeneratingCodeBlock && (
            <>
              <CopyButton text={props.codeBlockContent} />
              <ApplyActions
                applyState={applyState}
                onClickApply={onClickApply}
                onClickAccept={onClickAcceptApply}
                onClickReject={onClickRejectApply}
              />
            </>
          )}
        </div>
      </ToolbarDiv>

      {isExpanded && (
        <div
          className={`overflow-hidden overflow-y-auto ${
            isExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {props.children}
        </div>
      )}
    </TopDiv>
  );
}
