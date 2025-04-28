import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { useContext, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  defaultBorderRadius,
  vscCommandCenterInactiveBorder,
  vscEditorBackground,
} from "../..";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useIdeMessengerRequest } from "../../../hooks";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { useAppSelector } from "../../../redux/hooks";
import {
  selectApplyStateByStreamId,
  selectIsInEditMode,
} from "../../../redux/slices/sessionSlice";
import { getFontSize } from "../../../util";
import { isTerminalCodeBlock } from "../utils";
import { ApplyActions } from "./ApplyActions";
import { CopyButton } from "./CopyButton";
import { CreateFileButton } from "./CreateFileButton";
import { FileInfo } from "./FileInfo";
import { GeneratingCodeLoader } from "./GeneratingCodeLoader";
import { InsertButton } from "./InsertButton";
import { RunInTerminalButton } from "./RunInTerminalButton";

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
  isFinalCodeblock: boolean;
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
  isFinalCodeblock,
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

  const [relativeFilepathUri, setRelativeFilepathUri] = useState<string | null>(
    null,
  );

  const fileExistsInput = useMemo(
    () => (relativeFilepathUri ? { filepath: relativeFilepathUri } : null),
    [relativeFilepathUri],
  );

  const {
    result: fileExists,
    refresh: refreshFileExists,
    isLoading: isLoadingFileExists,
  } = useIdeMessengerRequest("fileExists", fileExistsInput);

  const nextCodeBlockIndex = useAppSelector(
    (state) => state.session.codeBlockApplyStates.curIndex,
  );

  const applyState = useAppSelector((state) =>
    selectApplyStateByStreamId(state, codeBlockStreamId),
  );

  /**
   * In the case where `relativeFilepath` is defined, this will just be `relativeFilepathUri`.
   * However, if no `relativeFilepath` is defined, then this will
   * be the URI of the currently open file at the time the user clicks "Apply".
   */
  const [appliedFileUri, setAppliedFileUri] = useState<string | undefined>(
    undefined,
  );

  const isNextCodeBlock = nextCodeBlockIndex === codeBlockIndex;
  const hasFileExtension =
    relativeFilepath && /\.[0-9a-z]+$/i.test(relativeFilepath);

  const isStreaming = useAppSelector((store) => store.session.isStreaming);
  const isGeneratingCodeBlock = isFinalCodeblock && isStreaming;

  // If we are creating a file, we already render that in the button
  // so we don't want to dispaly it twice here
  const displayFilepath = relativeFilepath ?? appliedFileUri;

  // TODO: This logic should be moved to a thunk
  // Handle apply keyboard shortcut
  useWebviewListener(
    "applyCodeFromChat",
    async () => onClickApply(),
    [isNextCodeBlock, codeBlockContent],
    !isNextCodeBlock,
  );

  useEffect(() => {
    const getRelativeFilepathUri = async () => {
      if (relativeFilepath) {
        const resolvedUri = await inferResolvedUriFromRelativePath(
          relativeFilepath,
          ideMessenger.ide,
        );
        setRelativeFilepathUri(resolvedUri);
      }
    };
    getRelativeFilepathUri();
  }, [relativeFilepath, ideMessenger.ide]);

  async function getFileUriToApplyTo() {
    // If we've already resolved a file URI (from clicking apply), use that
    if (appliedFileUri) {
      return appliedFileUri;
    }

    // If we have the `relativeFilepathUri`, use that
    if (relativeFilepathUri) {
      return relativeFilepathUri;
    }

    // If no filepath was provided, get the current file
    const currentFile = await ideMessenger.ide.getCurrentFile();
    if (currentFile) {
      return currentFile.path;
    }

    return undefined;
  }

  async function onClickApply() {
    const fileUri = await getFileUriToApplyTo();
    if (!fileUri) {
      ideMessenger.ide.showToast(
        "error",
        "Could not resolve filepath to apply changes",
      );
      return;
    }

    // applyToFile will create the file if it doesn't exist
    ideMessenger.post("applyToFile", {
      streamId: codeBlockStreamId,
      filepath: fileUri,
      text: codeBlockContent,
    });

    setAppliedFileUri(fileUri);
    refreshFileExists();
  }

  function onClickInsertAtCursor() {
    ideMessenger.post("insertAtCursor", { text: codeBlockContent });
  }

  async function handleDiffAction(action: "accept" | "reject") {
    const filepath = await getFileUriToApplyTo();
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

    setAppliedFileUri(undefined);
  }

  function onClickFilename() {
    if (appliedFileUri) {
      ideMessenger.post("showFile", {
        filepath: appliedFileUri,
      });
    }

    if (relativeFilepath) {
      ideMessenger.post("showFile", {
        filepath: relativeFilepath,
      });
    }
  }

  const renderActionButtons = () => {
    if (isTerminalCodeBlock(language, codeBlockContent)) {
      return <RunInTerminalButton command={codeBlockContent} />;
    }

    if (isLoadingFileExists) {
      return null;
    }

    if (fileExists || !relativeFilepath) {
      return (
        <ApplyActions
          disableManualApply={disableManualApply}
          applyState={applyState}
          onClickApply={onClickApply}
          onClickAccept={() => handleDiffAction("accept")}
          onClickReject={() => handleDiffAction("reject")}
        />
      );
    }

    return <CreateFileButton onClick={onClickApply} />;
  };

  // We wait until there is an extension in the filepath to avoid rendering
  // an incomplete filepath
  if (relativeFilepath && !hasFileExtension) {
    return children;
  }

  return (
    <TopDiv>
      <ToolbarDiv isExpanded={isExpanded} className="find-widget-skip gap-3">
        <div className="flex max-w-72 flex-row items-center">
          <ChevronDownIcon
            onClick={() => setIsExpanded(!isExpanded)}
            className={`text-lightgray h-3.5 w-3.5 flex-shrink-0 cursor-pointer hover:brightness-125 ${
              isExpanded ? "rotate-0" : "-rotate-90"
            }`}
          />
          {displayFilepath ? (
            <FileInfo
              filepath={displayFilepath}
              range={range}
              onClick={fileExists ? onClickFilename : undefined}
            />
          ) : (
            <span className="text-lightgray ml-2 select-none capitalize">
              {language}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {!isGeneratingCodeBlock && (
            <div className="xs:flex hidden items-center gap-2.5">
              <InsertButton onInsert={onClickInsertAtCursor} />
              <CopyButton text={codeBlockContent} />
            </div>
          )}

          {isGeneratingCodeBlock || applyState?.status === "not-started" ? (
            <GeneratingCodeLoader
              showLineCount={!isExpanded}
              codeBlockContent={codeBlockContent}
              isPending={
                applyState?.status === "not-started" && !isGeneratingCodeBlock
              }
            />
          ) : (
            renderActionButtons()
          )}
        </div>
      </ToolbarDiv>

      {isExpanded && (
        <div className="overflow-hidden overflow-y-auto">{children}</div>
      )}
    </TopDiv>
  );
}
