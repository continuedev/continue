import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { ApplyState } from "core";
import { getUriPathBasename } from "core/util/uri";
import { diffLines } from "diff";
import { useMemo, useState } from "react";
import AcceptRejectDiffButtons from "../../../components/AcceptRejectDiffButtons";
import FileIcon from "../../../components/FileIcon";

interface ModifiedFilesMenuProps {
  applyStates: ApplyState[];
  roundedTop?: boolean;
}

interface FileChangeSummary {
  filepath: string;
  applyStates: ApplyState[];
  added: number;
  removed: number;
}

function countDiffLines(parts: ReturnType<typeof diffLines>): {
  added: number;
  removed: number;
} {
  let added = 0;
  let removed = 0;

  for (const part of parts) {
    const lines = part.value.split("\n");
    const count =
      lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;

    if (part.added) {
      added += count;
    } else if (part.removed) {
      removed += count;
    }
  }

  return { added, removed };
}

function getApplyStateStats(applyState: ApplyState): {
  added: number;
  removed: number;
} {
  if (
    typeof applyState.originalFileContent !== "string" ||
    typeof applyState.fileContent !== "string"
  ) {
    return { added: 0, removed: 0 };
  }

  return countDiffLines(
    diffLines(applyState.originalFileContent, applyState.fileContent),
  );
}

function getFilePathContext(filepath: string): string | undefined {
  const normalizedPath = filepath.replace(/^file:\/\//, "");
  const pathSegments = normalizedPath.split(/[\\/]/).filter(Boolean);

  if (pathSegments.length <= 1) {
    return undefined;
  }

  const parentSegments = pathSegments.slice(0, -1);
  if (parentSegments.length === 0) {
    return undefined;
  }

  return parentSegments.slice(-2).join("/");
}

function buildFileSummaries(applyStates: ApplyState[]): FileChangeSummary[] {
  const grouped = applyStates.reduce(
    (acc, applyState) => {
      const filepath = applyState.filepath ?? "";
      if (!acc[filepath]) {
        acc[filepath] = [];
      }
      acc[filepath].push(applyState);
      return acc;
    },
    {} as Record<string, ApplyState[]>,
  );

  return Object.entries(grouped).map(([filepath, fileApplyStates]) => {
    const stats = fileApplyStates.reduce(
      (acc, state) => {
        const stateStats = getApplyStateStats(state);
        acc.added += stateStats.added;
        acc.removed += stateStats.removed;
        return acc;
      },
      { added: 0, removed: 0 },
    );

    return {
      filepath,
      applyStates: fileApplyStates,
      added: stats.added,
      removed: stats.removed,
    };
  });
}

export function ModifiedFilesMenu({
  applyStates,
  roundedTop = true,
}: ModifiedFilesMenuProps) {
  const [open, setOpen] = useState(true);
  const actionableApplyStates = useMemo(
    () => applyStates.filter((state) => state.status === "done"),
    [applyStates],
  );

  const fileSummaries = useMemo(
    () => buildFileSummaries(applyStates),
    [applyStates],
  );
  const totalAdded = fileSummaries.reduce((sum, file) => sum + file.added, 0);
  const totalRemoved = fileSummaries.reduce(
    (sum, file) => sum + file.removed,
    0,
  );
  const bodyId = "modified-files-menu-body";

  if (fileSummaries.length === 0) {
    return null;
  }

  return (
    <div className="mt-1" data-testid="modified-files-menu">
      <div
        className={`border-command-border bg-vsc-editor-background overflow-hidden border border-b-0 border-solid ${
          roundedTop ? "rounded-t-default" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <button
            type="button"
            data-testid="modified-files-menu-header"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((prev) => !prev)}
            className="text-description hover:bg-vsc-input-background/40 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border-none bg-transparent px-0.5 py-1 text-left"
          >
            {open ? (
              <ChevronDownIcon className="h-4 w-4 flex-shrink-0 opacity-70" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0 opacity-70" />
            )}
            <span className="truncate text-sm font-medium">
              {fileSummaries.length}{" "}
              {fileSummaries.length === 1 ? "file" : "files"} changed
            </span>
            <span className="ml-1 flex items-center gap-1 font-mono text-xs">
              {totalAdded > 0 && (
                <span className="text-success">+{totalAdded}</span>
              )}
              {totalRemoved > 0 && (
                <span className="text-error">-{totalRemoved}</span>
              )}
            </span>
          </button>

          <AcceptRejectDiffButtons
            applyStates={actionableApplyStates}
            testId="modified-files-menu-actions"
            className="px-0"
            onAcceptOrReject={async () => {}}
          />
        </div>

        <div
          id={bodyId}
          data-testid="modified-files-menu-body"
          className={`transition-all duration-200 ease-in-out ${
            open
              ? "max-h-[40vh] opacity-100"
              : "max-h-0 overflow-hidden opacity-0"
          }`}
        >
          <div className="thin-scrollbar border-command-border/60 max-h-[40vh] space-y-1 overflow-y-auto border-0 border-t border-solid px-3 pb-3 pt-2">
            {fileSummaries.map((fileSummary, index) => {
              const pathContext = fileSummary.filepath
                ? getFilePathContext(fileSummary.filepath)
                : undefined;
              const basename = fileSummary.filepath
                ? getUriPathBasename(fileSummary.filepath)
                : "Unsaved file";

              return (
                <div
                  key={fileSummary.filepath || `unsaved-${index}`}
                  className="bg-vsc-input-background/55 flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5"
                  data-testid={`modified-files-menu-row-${index}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {fileSummary.filepath ? (
                      <FileIcon
                        filename={fileSummary.filepath}
                        height="17px"
                        width="17px"
                      />
                    ) : (
                      <FolderIcon className="h-4 w-4 opacity-70" />
                    )}
                    <div className="min-w-0">
                      <div className="text-description truncate text-sm font-medium">
                        {basename}
                      </div>
                      <div className="text-description-muted flex items-center gap-2 text-[11px]">
                        {pathContext && (
                          <span className="truncate">{pathContext}</span>
                        )}
                        <span className="font-mono">
                          {fileSummary.added > 0 && (
                            <span className="text-success">
                              +{fileSummary.added}
                            </span>
                          )}
                          {fileSummary.removed > 0 && (
                            <span className="text-error ml-1">
                              -{fileSummary.removed}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
