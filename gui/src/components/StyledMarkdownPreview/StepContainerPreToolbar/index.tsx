import { evaluateTerminalCommandSecurity } from "@continuedev/terminal-security";
import {
  ChevronDownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { inferResolvedUriFromRelativePath } from "core/util/ideUtils";
import { renderContextItems } from "core/util/messageContent";
import { useContext, useEffect, useMemo, useState } from "react";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useIdeMessengerRequest } from "../../../hooks/useIdeMessengerRequest";
import { useWebviewListener } from "../../../hooks/useWebviewListener";
import { getStatusIcon } from "../../../pages/gui/ToolCallDiv/utils";
import { useAppSelector } from "../../../redux/hooks";
import { selectToolCallById } from "../../../redux/selectors/selectToolCalls";
import {
  selectApplyStateByStreamId,
  selectApplyStateByToolCallId,
} from "../../../redux/slices/sessionSlice";
import { getFontSize } from "../../../util";
import Spinner from "../../gui/Spinner";
import { isTerminalCodeBlock } from "../utils";
import { ApplyActions } from "./ApplyActions";
import { CollapsibleContainer } from "./CollapsibleContainer";
import { CopyButton } from "./CopyButton";
import { CreateFileButton } from "./CreateFileButton";
import { FileInfo } from "./FileInfo";
import { InsertButton } from "./InsertButton";
import { RunInTerminalButton } from "./RunInTerminalButton";

export interface StepContainerPreToolbarProps {
  showToolCallStatusIcon?: boolean;
  codeBlockContent: string;
  language: string | null;
  relativeFilepath?: string;
  itemIndex?: number;
  codeBlockIndex: number; // To track which codeblock we are applying
  isLastCodeblock: boolean;
  codeBlockStreamId: string;
  forceToolCallId?: string; // If this is defined, we will use this streamId instead of the one from the codeBlock
  range?: string;
  children: any;
  expanded?: boolean;
  disableManualApply?: boolean;
  collapsible?: boolean;
}

export const DANGEROUS_COMMAND_WARNING_MESSAGE =
  "Potentially dangerous command";

export function StepContainerPreToolbar({
  showToolCallStatusIcon,
  codeBlockContent,
  language,
  relativeFilepath,
  itemIndex,
  codeBlockIndex,
  isLastCodeblock,
  codeBlockStreamId,
  forceToolCallId,
  range,
  children,
  expanded,
  disableManualApply,
  collapsible,
}: StepContainerPreToolbarProps) {
  const ideMessenger = useContext(IdeMessengerContext);
  const history = useAppSelector((state) => state.session.history);
  const [isExpanded, setIsExpanded] = useState(expanded ?? true);

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
  const toolCallApplyState = useAppSelector((state) =>
    selectApplyStateByToolCallId(state, forceToolCallId),
  );

  const toolCallState = useAppSelector((state) =>
    forceToolCallId ? selectToolCallById(state, forceToolCallId) : undefined,
  );

  const toolCallStatusIcon =
    showToolCallStatusIcon &&
    (toolCallState?.status === "canceled" ||
      toolCallState?.status === "errored" ||
      toolCallState?.status === "done") ? (
      <div
        className={`mr-1 h-4 w-4 flex-shrink-0 ${toolCallState.output ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (toolCallState.output) {
            ideMessenger.post("showVirtualFile", {
              name: "Edit output",
              content: renderContextItems(toolCallState.output),
            });
          }
        }}
      >
        {getStatusIcon(toolCallState.status)}
      </div>
    ) : null;

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

  const isLastItem = useMemo(() => {
    return itemIndex === history.length - 1;
  }, [history.length, itemIndex]);

  const isGeneratingCodeBlock = isLastItem && isLastCodeblock && isStreaming;

  // Check if this is a bash/shell code block and evaluate security
  const securityWarning = useMemo(() => {
    // Check if it's a terminal code block (includes bash, sh, or looks like terminal commands)
    if (isTerminalCodeBlock(language, codeBlockContent)) {
      // First try evaluating the entire block
      const wholeBlockEval = evaluateTerminalCommandSecurity(
        "allowedWithoutPermission",
        codeBlockContent,
      );
      if (
        wholeBlockEval === "disabled" ||
        wholeBlockEval === "allowedWithPermission"
      ) {
        return true;
      }

      // If the whole block seems safe, check individual lines
      // This catches cases where dangerous commands are mixed with comments
      const lines = codeBlockContent.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith("#")) {
          continue;
        }

        const lineEval = evaluateTerminalCommandSecurity(
          "allowedWithoutPermission",
          trimmedLine,
        );
        if (lineEval === "disabled" || lineEval === "allowedWithPermission") {
          return true;
        }
      }
    }
    return false;
  }, [language, codeBlockContent]);

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
    void getRelativeFilepathUri();
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
      void ideMessenger.ide.showToast(
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
    void refreshFileExists();
  }

  function onClickInsertAtCursor() {
    ideMessenger.post("insertAtCursor", { text: codeBlockContent });
  }

  async function handleDiffAction(action: "accept" | "reject") {
    const filepath = await getFileUriToApplyTo();
    if (!filepath) {
      void ideMessenger.ide.showToast(
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

  async function onClickFilename() {
    if (appliedFileUri) {
      ideMessenger.post("showFile", {
        filepath: appliedFileUri,
      });
    }

    if (relativeFilepath) {
      const filepath = await inferResolvedUriFromRelativePath(
        relativeFilepath,
        ideMessenger.ide,
      );

      ideMessenger.post("showFile", {
        filepath,
      });
    }
  }

  const renderActionButtons = () => {
    const isPendingToolCall = toolCallApplyState?.status === "not-started";

    if (isGeneratingCodeBlock || isPendingToolCall) {
      const numLines = codeBlockContent.split("\n").length;
      const plural = numLines === 1 ? "" : "s";
      if (isGeneratingCodeBlock) {
        return (
          <span className="text-lightgray inline-flex items-center gap-2 text-right">
            <div>
              <Spinner />
            </div>
          </span>
        );
      } else {
        return (
          <span className="text-lightgray inline-flex items-center gap-2 text-right">
            {`${numLines} line${plural} pending`}
          </span>
        );
      }
    }

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
          applyState={toolCallApplyState ?? applyState}
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
    <div className="outline-command-border -outline-offset-0.5 rounded-default bg-editor !my-2 flex min-w-0 flex-col outline outline-1">
      {securityWarning && (
        <div className="bg-warning/10 border-warning/30 text-warning flex items-center gap-2 border-b px-2 py-1.5 text-sm">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
          <span>{DANGEROUS_COMMAND_WARNING_MESSAGE}</span>
        </div>
      )}
      <div
        className={`find-widget-skip bg-editor sticky -top-2 z-10 m-0 flex items-center justify-between gap-3 px-1.5 py-1 ${isExpanded ? "rounded-t-default border-command-border border-b" : "rounded-default"}`}
        style={{ fontSize: `${getFontSize() - 2}px` }}
      >
        <div className="flex max-w-[50%] flex-row items-center">
          {toolCallStatusIcon}
          <ChevronDownIcon
            data-testid="toggle-codeblock"
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

          {renderActionButtons()}
        </div>
      </div>
      {isExpanded && (
        <CollapsibleContainer collapsible={collapsible}>
          {children}
        </CollapsibleContainer>
      )}
    </div>
  );
}
