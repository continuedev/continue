import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { debounce } from "lodash";
import { useContext, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppSelector } from "../../../redux/hooks";
import { selectDefaultModel } from "../../../redux/slices/configSlice";
import {
  selectApplyStateByStreamId,
  selectIsInEditMode,
} from "../../../redux/slices/sessionSlice";
import { getFontSize } from "../../../util";
import { childrenToText, isTerminalCodeBlock } from "../utils";
import ApplyActions from "./ApplyActions";
import CopyButton from "./CopyButton";
import FileInfo from "./FileInfo";
import GeneratingCodeLoader from "./GeneratingCodeLoader";
import RunInTerminalButton from "./RunInTerminalButton";

const TopDiv = styled.div`
  display: flex;
  flex-direction: column;
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
  codeBlockStreamId: string;
  range?: string;
  children: any;
  expanded?: boolean;
  disableManualApply?: boolean;
}

export default function StepContainerPreToolbar(
  props: StepContainerPreToolbarProps,
) {
  const ideMessenger = useContext(IdeMessengerContext);
  const wasGeneratingRef = useRef(props.isGeneratingCodeBlock);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const [isExpanded, setIsExpanded] = useState(
    props.expanded ?? (isInEditMode ? false : true),
  );
  const [codeBlockContent, setCodeBlockContent] = useState("");

  const nextCodeBlockIndex = useAppSelector(
    (state) => state.session.codeBlockApplyStates.curIndex,
  );

  const applyState = useAppSelector((state) =>
    selectApplyStateByStreamId(state, props.codeBlockStreamId),
  );

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
      streamId: props.codeBlockStreamId,
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

  // useEffect(() => {
  //   const hasCompletedGenerating =
  //     wasGeneratingRef.current && !isGeneratingCodeBlock;

  //   wasGeneratingRef.current = isGeneratingCodeBlock;
  //   if (hasCompletedGenerating) {
  //     if (props.autoApply) {
  //       onClickApply();
  //     }
  //   }
  // }, [wasGeneratingRef, isGeneratingCodeBlock, props.autoApply]);

  async function onClickAcceptApply() {
    const fileUri = await inferResolvedUriFromRelativePath(
      props.relativeFilepath,
      ideMessenger.ide,
    );
    ideMessenger.post("acceptDiff", {
      filepath: fileUri,
      streamId: props.codeBlockStreamId,
    });
  }

  async function onClickRejectApply() {
    const fileUri = await inferResolvedUriFromRelativePath(
      props.relativeFilepath,
      ideMessenger.ide,
    );
    ideMessenger.post("rejectDiff", {
      filepath: fileUri,
      streamId: props.codeBlockStreamId,
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
      <ToolbarDiv isExpanded={isExpanded} className="find-widget-skip gap-3">
        <div className="flex max-w-72 flex-row items-center">
          <ChevronDownIcon
            onClick={onClickExpand}
            className={`h-3.5 w-3.5 flex-shrink-0 cursor-pointer text-gray-400 hover:brightness-125 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          <FileInfo
            relativeFilepath={props.relativeFilepath}
            range={props.range}
          />
        </div>

        <div className="flex items-center gap-3 max-sm:gap-1.5">
          {props.isGeneratingCodeBlock ? (
            <GeneratingCodeLoader
              showLineCount={!isExpanded}
              codeBlockContent={codeBlockContent}
            />
          ) : (
            <>
              <CopyButton text={props.codeBlockContent} />
              {isTerminalCodeBlock(props.language, props.codeBlockContent) ? (
                <RunInTerminalButton command={props.codeBlockContent} />
              ) : (
                <ApplyActions
                  disableManualApply={props.disableManualApply}
                  applyState={applyState}
                  onClickApply={onClickApply}
                  onClickAccept={onClickAcceptApply}
                  onClickReject={onClickRejectApply}
                />
              )}
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
