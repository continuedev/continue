import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { EditOperation } from "core/tools/definitions/multiEdit";
import { renderContextItems } from "core/util/messageContent";
import { getLastNPathParts, getUriPathBasename } from "core/util/uri";
import { ChangeObject, diffLines } from "diff";
import { useContext, useMemo, useState } from "react";
import { ApplyActions } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/ApplyActions";
import { FileInfo } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/FileInfo";
import { IdeMessengerContext } from "../../../context/IdeMessenger";
import { useAppSelector } from "../../../redux/hooks";
import {
  selectApplyStateByToolCallId,
  selectToolCallById,
} from "../../../redux/selectors/selectToolCalls";
import { performFindAndReplace } from "../../../util/clientTools/findAndReplaceUtils";
import { getStatusIcon } from "./utils";

interface FindAndReplaceDisplayProps {
  fileUri?: string;
  editingFileContents?: string;
  relativeFilePath?: string;
  edits: EditOperation[];
  toolCallId: string;
  historyIndex: number;
}

export function FindAndReplaceDisplay({
  fileUri,
  relativeFilePath,
  editingFileContents,
  edits,
  toolCallId,
  historyIndex,
}: FindAndReplaceDisplayProps) {
  const [isExpanded, setIsExpanded] = useState<boolean | undefined>(undefined);
  const ideMessenger = useContext(IdeMessengerContext);
  const applyState: ApplyState | undefined = useAppSelector((state) =>
    selectApplyStateByToolCallId(state, toolCallId),
  );

  const toolCallState = useAppSelector((state) =>
    selectToolCallById(state, toolCallId),
  );
  const showContent = isExpanded ?? toolCallState?.status === "generated";
  const config = useAppSelector((state) => state.config.config);

  const displayName = useMemo(() => {
    if (fileUri) {
      return getUriPathBasename(fileUri);
    }
    if (relativeFilePath) {
      return getLastNPathParts(relativeFilePath, 1);
    }
    return "";
  }, [fileUri, relativeFilePath]);

  // Get file content from tool call state instead of reading file
  const currentFileContent = useMemo(() => {
    if (editingFileContents) {
      return editingFileContents;
    }
    return edits?.map((edit) => edit.old_string ?? "").join("\n");
  }, [editingFileContents, edits]);

  const diffResult = useMemo(() => {
    if (!currentFileContent) {
      return null;
    }

    try {
      // Apply all edits sequentially
      let newContent = currentFileContent;
      for (let i = 0; i < edits.length; i++) {
        const {
          old_string: oldString,
          new_string: newString,
          replace_all: replaceAll,
        } = edits[i];
        newContent = performFindAndReplace(
          newContent,
          oldString,
          newString,
          replaceAll,
          i,
        );
      }

      // Generate diff between original and final content
      const diff = diffLines(currentFileContent, newContent);
      return { diff, newContent, error: null };
    } catch (error) {
      return {
        diff: null,
        newContent: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, [currentFileContent, edits]);

  const statusIcon = useMemo(() => {
    const status = toolCallState?.status;
    if (status) {
      if (status === "canceled" || status === "errored" || status === "done") {
        return (
          <div
            className={`mr-1 h-4 w-4 flex-shrink-0 ${toolCallState.output ? "cursor-pointer" : ""}`}
            onClick={(e) => {
              if (toolCallState.output) {
                e.stopPropagation();
                ideMessenger.post("showVirtualFile", {
                  name: "Edit output",
                  content: renderContextItems(toolCallState.output),
                });
              }
            }}
          >
            {getStatusIcon(toolCallState.status)}
          </div>
        );
      }
    }
  }, [toolCallState?.status, toolCallState?.output]);

  const processedDiff: (ChangeObject<string> | { ellipsis: true })[] =
    useMemo(() => {
      if (!diffResult?.diff) return [];

      const MAX_CONTEXT_LINES = 2;
      const processed: (ChangeObject<string> | { ellipsis: true })[] = [];

      for (let i = 0; i < diffResult.diff.length; i++) {
        const part = diffResult.diff[i];

        if (part.added || part.removed) {
          processed.push(part);
        } else {
          // This is an unchanged part
          const lines = part.value.split("\n");
          // Remove empty line at the end if it exists
          if (lines[lines.length - 1] === "") {
            lines.pop();
          }

          const isFirstPart = i === 0;
          const isLastPart = i === diffResult.diff.length - 1;
          const hasChangesAfter =
            i < diffResult.diff.length - 1 &&
            diffResult.diff.slice(i + 1).some((p) => p.added || p.removed);
          const hasChangesBefore =
            i > 0 &&
            diffResult.diff.slice(0, i).some((p) => p.added || p.removed);

          let startIndex = 0;
          let endIndex = lines.length;
          let addEllipsisAtStart = false;
          let addEllipsisAtEnd = false;

          if (isFirstPart && hasChangesAfter) {
            // Show only last MAX_CONTEXT_LINES lines
            const newStartIndex = Math.max(0, lines.length - MAX_CONTEXT_LINES);
            if (newStartIndex > 0) {
              addEllipsisAtStart = true;
            }
            startIndex = newStartIndex;
          } else if (isLastPart && hasChangesBefore) {
            // Show only first MAX_CONTEXT_LINES lines
            const newEndIndex = Math.min(lines.length, MAX_CONTEXT_LINES);
            if (newEndIndex < lines.length) {
              addEllipsisAtEnd = true;
            }
            endIndex = newEndIndex;
          } else if (
            !isFirstPart &&
            !isLastPart &&
            (hasChangesBefore || hasChangesAfter)
          ) {
            // Show MAX_CONTEXT_LINES at start and end
            if (lines.length > MAX_CONTEXT_LINES * 2) {
              const contextLines = [
                ...lines.slice(0, MAX_CONTEXT_LINES),
                ...lines.slice(-MAX_CONTEXT_LINES),
              ];
              processed.push({
                ...part,
                value:
                  contextLines.slice(0, MAX_CONTEXT_LINES).join("\n") + "\n",
              });

              // Add ellipsis indicator
              processed.push({
                ellipsis: true,
              });

              processed.push({
                ...part,
                value: contextLines.slice(MAX_CONTEXT_LINES).join("\n") + "\n",
              });
              continue;
            }
          }

          if (startIndex < endIndex) {
            const visibleLines = lines.slice(startIndex, endIndex);
            if (visibleLines.length > 0) {
              if (addEllipsisAtStart) {
                processed.unshift({ ellipsis: true });
              }

              processed.push({
                ...part,
                value: visibleLines.join("\n") + "\n",
              });

              if (addEllipsisAtEnd) {
                processed.push({ ellipsis: true });
              }
            }
          }
        }
      }

      return processed;
    }, [diffResult?.diff]);

  // Unified container component that always renders the same structure
  const renderContainer = (content: React.ReactNode) => (
    <div className="outline-command-border -outline-offset-0.5 rounded-default bg-editor mx-2 my-1 flex min-w-0 flex-col outline outline-1">
      <div
        className={`find-widget-skip bg-editor sticky -top-2 z-10 m-0 flex cursor-pointer items-center justify-between gap-3 px-1.5 py-1 ${showContent ? "rounded-t-default border-command-border border-b" : "rounded-default"}`}
        onClick={() => {
          setIsExpanded(!showContent);
        }}
      >
        <div className="flex max-w-[50%] flex-row items-center text-xs">
          {statusIcon}
          <ChevronDownIcon
            data-testid="toggle-find-and-replace-diff"
            className={`text-lightgray h-3.5 w-3.5 flex-shrink-0 cursor-pointer select-none transition-all hover:brightness-125 ${
              showContent ? "rotate-0" : "-rotate-90"
            }`}
          />
          <FileInfo
            filepath={displayName || "..."}
            onClick={(e) => {
              if (!fileUri) {
                return;
              }
              e.stopPropagation();
              ideMessenger.post("openFile", { path: fileUri });
            }}
          />
        </div>

        {applyState && (
          <ApplyActions
            onClickAccept={() => {
              ideMessenger.post(`acceptDiff`, {
                filepath: fileUri,
                streamId: applyState.streamId,
              });
            }}
            onClickReject={() => {
              ideMessenger.post(`rejectDiff`, {
                filepath: fileUri,
                streamId: applyState.streamId,
              });
            }}
            disableManualApply={true}
            applyState={applyState}
          />
        )}
      </div>
      {showContent ? content : null}
    </div>
  );

  if (diffResult?.error) {
    return renderContainer(
      <div className="text-error p-3 text-sm">
        <strong>Error generating diff</strong>
      </div>,
    );
  }

  if (
    !diffResult?.diff ||
    (diffResult.diff.length === 1 &&
      !diffResult.diff[0].added &&
      !diffResult.diff[0].removed)
  ) {
    return renderContainer(
      <div className="text-description-muted p-3">No changes to display</div>,
    );
  }

  return renderContainer(
    <div
      className={`${config?.ui?.showChatScrollbar ? "thin-scrollbar" : "no-scrollbar"} max-h-72 overflow-auto`}
    >
      <pre
        className={`bg-editor m-0 w-fit min-w-full text-xs leading-tight ${config?.ui?.codeWrap ? "whitespace-pre-wrap" : "whitespace-pre"}`}
      >
        {processedDiff.map((part, index) => {
          if ("ellipsis" in part) {
            return (
              <div
                key={index}
                className="text-description-muted px-3 py-1 text-center font-mono"
              >
                ⋯
              </div>
            );
          }

          if (part.removed) {
            return (
              <div
                key={index}
                className="text-foreground border-l-4 border-red-900 bg-red-900/30"
              >
                {part.value.split("\n").map((line, lineIndex) => {
                  if (
                    line === "" &&
                    lineIndex === part.value.split("\n").length - 1
                  )
                    return null;
                  return (
                    <div key={lineIndex} className="px-3 py-px font-mono">
                      <span className="mr-2 select-none text-red-600">-</span>
                      {line}
                    </div>
                  );
                })}
              </div>
            );
          } else if (part.added) {
            return (
              <div
                key={index}
                className="text-foreground border-l-4 border-green-600 bg-green-600/20"
              >
                {part.value.split("\n").map((line, lineIndex) => {
                  if (
                    line === "" &&
                    lineIndex === part.value.split("\n").length - 1
                  )
                    return null;
                  return (
                    <div key={lineIndex} className="px-3 py-px font-mono">
                      <span className="mr-2 select-none text-green-600">+</span>
                      {line}
                    </div>
                  );
                })}
              </div>
            );
          } else {
            return (
              <div key={index}>
                {part.value.split("\n").map((line, lineIndex) => {
                  if (
                    line === "" &&
                    lineIndex === part.value.split("\n").length - 1
                  )
                    return null;
                  return (
                    <div
                      key={lineIndex}
                      className="text-foreground px-3 py-px font-mono"
                    >
                      <span className="text-description-muted mr-2 select-none">
                        {" "}
                      </span>
                      {line}
                    </div>
                  );
                })}
              </div>
            );
          }
        })}
      </pre>
    </div>,
  );
}
