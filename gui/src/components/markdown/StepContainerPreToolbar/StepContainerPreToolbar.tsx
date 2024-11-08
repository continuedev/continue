import { debounce } from "lodash";
import { useContext, useEffect, useRef, useState } from "react";
import AutoApplyStatusIndicators from "./AutoApplyStatusIndicators";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import {
  incrementNextCodeBlockToApplyIndex,
  updateApplyState,
} from "../../../redux/slices/uiStateSlice";
import CodeBlockActions from "./CodeBlockActions";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../redux/store";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import {
  childrenToText,
  getTerminalCommand,
  isTerminalCodeBlock,
} from "./utils";
import { v4 as uuidv4 } from "uuid";
import { defaultModelSelector } from "../../../redux/selectors/modelSelectors";
import { defaultBorderRadius, lightGray, vscEditorBackground } from "../..";
import { getFontSize } from "../../../util";
import FileInfo from "./FileInfo";
import styled from "styled-components";

const TopDiv = styled.div`
  outline: 1px solid rgba(153, 153, 152);
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px;
  background-color: ${vscEditorBackground};
`;

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

export interface StepContainerPreToolbarProps {
  language: string;
  filepath: string;
  isGenerating: boolean;
  codeBlockIndex: number; // To track which codeblock we are applying
  children: any;
}

export default function StepContainerPreToolbar(
  props: StepContainerPreToolbarProps,
) {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const streamIdRef = useRef<string | null>(null);
  const defaultModel = useSelector(defaultModelSelector);
  const [isExpanded, setIsExpanded] = useState(false);
  const [codeBlockContent, setCodeBlockContent] = useState("");
  const nextCodeBlockIndex = useSelector(
    (state: RootState) => state.uiState.nextCodeBlockToApplyIndex,
  );
  const applyStateStatus = useSelector(
    (store: RootState) =>
      store.uiState.applyStates.find(
        (state) => state.streamId === streamIdRef.current,
      )?.status ?? "closed",
  );

  const isMultifileEdit = true; // TODO: Pull from Redux state
  const numLinesGenerated = 10; // TODO: Calculate from codeBlockContent

  const isTerminal = isTerminalCodeBlock(props.language, codeBlockContent);
  const isNextCodeBlock = nextCodeBlockIndex === props.codeBlockIndex;
  const hasFileExtension = /\.[0-9a-z]+$/i.test(props.filepath);

  if (streamIdRef.current === null) {
    streamIdRef.current = uuidv4();
  }

  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    handleApply,
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

  async function handleApply() {
    if (applyStateStatus === "streaming") return;

    if (isTerminal) {
      ideMessenger.ide.runCommand(getTerminalCommand(codeBlockContent));
    } else {
      await ideMessenger.request("applyToFile", {
        text: codeBlockContent,
        streamId: streamIdRef.current,
        curSelectedModelTitle: defaultModel.title,
        filepath: props.filepath,
      });

      dispatch(
        updateApplyState({
          streamId: streamIdRef.current,
          status: "streaming",
        }),
      );
    }

    dispatch(incrementNextCodeBlockToApplyIndex({}));
  }

  function onClickExpand() {
    setIsExpanded(!isExpanded);
  }

  // If we don't have a file extension, we don't render any toolbar
  if (!hasFileExtension) {
    return props.children;
  }

  return (
    <TopDiv>
      <ToolbarDiv>
        <FileInfo
          filepath={props.filepath}
          onClickExpand={onClickExpand}
          isExpanded={isExpanded}
          numLines={numLinesGenerated}
        />

        {isMultifileEdit ? (
          <AutoApplyStatusIndicators
            isGenerating={props.isGenerating}
            applyStateStatus={applyStateStatus}
            onGeneratingComplete={handleApply}
            codeBlockContent={codeBlockContent}
          />
        ) : (
          <CodeBlockActions
            {...props}
            handleApply={handleApply}
            codeBlockContent={codeBlockContent}
          />
        )}
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
