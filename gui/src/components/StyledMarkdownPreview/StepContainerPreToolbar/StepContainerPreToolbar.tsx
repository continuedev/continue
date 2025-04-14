import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { useContext, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppSelector } from "../../../redux/hooks";
import {
  selectApplyStateByStreamId,
  selectIsInEditMode,
} from "../../../redux/slices/sessionSlice";
import { getFontSize } from "../../../util";
import { isTerminalCodeBlock } from "../utils";
import ApplyActions from "./ApplyActions";
import CopyButton from "./CopyButton";
import { FileInfo } from "./FileInfo";
import GeneratingCodeLoader from "./GeneratingCodeLoader";
import InsertButton from "./InsertButton";
import RunInTerminalButton from "./RunInTerminalButton";

const TopDiv = styled.div`
  display: flex;
  flex-direction: column;
  outline: 1px solid ${vscCommandCenterInactiveBorder};
  outline-offset: -0.5px;
  border-radius: ${defaultBorderRadius};
  margin-bottom: 8px !important;
  margin-top: 8px !important;
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
  relativeFilepath?: string;
  isGeneratingCodeBlock: boolean;
  codeBlockIndex: number; // To track which codeblock we are applying
  codeBlockStreamId: string;
  range?: string;
  children: any;
  expanded?: boolean;
  disableManualApply?: boolean;
}

export function StepContainerPreToolbar({
  codeBlockContent,
  language,
  relativeFilepath,
  isGeneratingCodeBlock,
  codeBlockIndex,
  codeBlockStreamId,
  range,
  children,
  expanded,
  disableManualApply,
}: StepContainerPreToolbarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const isInEditMode = useAppSelector(selectIsInEditMode);
  const [isExpanded, setIsExpanded] = useState(
    expanded ?? (isInEditMode ? false : true),
  );

  // We store the resolved file URI to ensure we use the same file when
  // accepting/rejecting diffs, even if no `relativeFilepath` is provided
  const [resolvedFileUri, setResolvedFileUri] = useState<string | undefined>(
    undefined,
  );
  const nextCodeBlockIndex = useAppSelector(
    (state) => state.session.codeBlockApplyStates.curIndex,
  );

  const applyState = useAppSelector((state) =>
    selectApplyStateByStreamId(state, codeBlockStreamId),
  );

  const isNextCodeBlock = nextCodeBlockIndex === codeBlockIndex;
  const hasFileExtension =
    relativeFilepath && /\.[0-9a-z]+$/i.test(relativeFilepath);

  const displayFilepath = relativeFilepath ?? resolvedFileUri;

  async function getFileUri() {
    // If we've already resolved a file URI (from clicking apply), use that
    if (resolvedFileUri) {
      return resolvedFileUri;
    }

    // If a relative filepath was provided, try to resolve it
    if (relativeFilepath) {
      return await inferResolvedUriFromRelativePath(
        relativeFilepath,
        ideMessenger.ide,
      );
    }

    // If no filepath was provided, get the current file
    const currentFile = await ideMessenger.ide.getCurrentFile();
    if (currentFile) {
      return currentFile.path;
    }

    return undefined;
  }

  async function onClickApply() {
    const fileUri = await getFileUri();
    if (!fileUri) {
      ideMessenger.ide.showToast(
        "error",
        "Could not resolve filepath to apply changes",
      );

      return;
    }

    setResolvedFileUri(fileUri);

    ideMessenger.post("applyToFile", {
      streamId: codeBlockStreamId,
      filepath: fileUri,
      text: codeBlockContent,
    });
  }

  function onClickInsertAtCursor() {
    ideMessenger.post("insertAtCursor", { text: codeBlockContent });
  }

  // TODO: This logic should be moved to a thunk
  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => onClickApply(),
    [isNextCodeBlock, codeBlockContent],
    !isNextCodeBlock,
  );

  async function handleDiffAction(action: "accept" | "reject") {
    const filepath = await getFileUri();
    if (!filepath) {
      ideMessenger.ide.showToast(
        "error",
        `Could not resolve filepath to ${action} changes`,
      );
      return;
    }

    ideMessenger.post(`${action}Diff`, {
      filepath,
      streamId: codeBlockStreamId,
    });

    setResolvedFileUri(undefined);
  }

  function onClickFilename() {
    if (resolvedFileUri) {
      ideMessenger.post("showFile", {
        filepath: resolvedFileUri,
      });
    }

    if (relativeFilepath) {
      ideMessenger.post("showFile", {
        filepath: relativeFilepath,
      });
    }
  }

  // We want until there is an extension in the filepath to avoid rendering
  //  an incomplete filepath
  if (relativeFilepath && !hasFileExtension) {
    return children;
  }

  return (
    <TopDiv>
      <ToolbarDiv isExpanded={isExpanded} className="find-widget-skip gap-3">
        <div className="flex max-w-72 flex-row items-center">
          <ChevronDownIcon
            onClick={() => setIsExpanded(!isExpanded)}
            className={`h-3.5 w-3.5 flex-shrink-0 cursor-pointer text-gray-400 hover:brightness-125 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          {displayFilepath ? (
            <FileInfo
              filepath={displayFilepath}
              range={range}
              onClick={onClickFilename}
            />
          ) : (
            <span className="ml-2 capitalize text-gray-400">{language}</span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {isGeneratingCodeBlock ? (
            <GeneratingCodeLoader
              showLineCount={!isExpanded}
              codeBlockContent={codeBlockContent}
            />
          ) : (
            <>
              <InsertButton onInsert={onClickInsertAtCursor} />
              <CopyButton text={codeBlockContent} />

              {isTerminalCodeBlock(language, codeBlockContent) ? (
                <RunInTerminalButton command={codeBlockContent} />
              ) : (
                <ApplyActions
                  disableManualApply={disableManualApply}
                  applyState={applyState}
                  onClickApply={onClickApply}
                  onClickAccept={() => handleDiffAction("accept")}
                  onClickReject={() => handleDiffAction("reject")}
                />
              )}
            </>
          )}
        </div>
      </ToolbarDiv>

      {isExpanded && (
        <div className="overflow-hidden overflow-y-auto">{children}</div>
      )}
    </TopDiv>
  );
}
