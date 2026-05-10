import { ApplyState } from "core";
import { getUriPathBasename } from "core/util/uri";
import { useState } from "react";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileIcon from "../../../FileIcon";

const DEFAULT_VISIBLE_PENDING_FILES = 3;

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

function getHiddenPendingGroupLabel(filepath: string): string {
  if (!filepath) {
    return "Unsaved files";
  }

  return getFilePathContext(filepath) ?? getUriPathBasename(filepath);
}

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group apply states by filepath
  const applyStatesByFilepath = pendingApplyStates.reduce(
    (acc, state) => {
      const filepath = state.filepath || ""; // Use empty string as fallback
      if (!acc[filepath]) {
        acc[filepath] = [];
      }
      acc[filepath].push(state);
      return acc;
    },
    {} as Record<string, ApplyState[]>,
  );
  const pendingFiles = Object.entries(applyStatesByFilepath);
  const totalPendingChanges = pendingFiles.reduce(
    (count, [, states]) => count + states.length,
    0,
  );
  const showBatchActions = pendingFiles.length > 1;
  const hasOverflow = pendingFiles.length > DEFAULT_VISIBLE_PENDING_FILES;
  const visiblePendingFiles =
    hasOverflow && !isExpanded
      ? pendingFiles.slice(0, DEFAULT_VISIBLE_PENDING_FILES)
      : pendingFiles;
  const hiddenPendingFilesCount = Math.max(
    pendingFiles.length - visiblePendingFiles.length,
    0,
  );
  const hiddenPreviewGroups = pendingFiles
    .slice(visiblePendingFiles.length)
    .reduce(
      (acc, [filepath]) => {
        const label = getHiddenPendingGroupLabel(filepath);
        acc[label] = (acc[label] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  return (
    <div
      className="bg-vsc-editor-background border-command-border overflow-hidden rounded-xl border border-solid"
      data-testid="pending-apply-rail"
    >
      <div className="border-command-border border-0 border-b border-solid px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Pending edits</div>
              <div
                className="flex flex-wrap items-center gap-1.5"
                data-testid="pending-apply-summary"
              >
                <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {pendingFiles.length}{" "}
                  {pendingFiles.length === 1 ? "file" : "files"}
                </span>
                <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {totalPendingChanges}{" "}
                  {totalPendingChanges === 1 ? "change" : "changes"}
                </span>
              </div>
            </div>
            <div className="text-description-muted mt-0.5 text-[11px]">
              Review before your next send.
            </div>
          </div>

          {showBatchActions && (
            <AcceptRejectDiffButtons
              applyStates={pendingApplyStates}
              testId="pending-apply-batch-actions"
              className="px-0"
              onAcceptOrReject={async () => {}}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 p-2" id="pending-apply-file-list">
        {visiblePendingFiles.map(([filepath, states], index) => {
          const pathContext = filepath
            ? getFilePathContext(filepath)
            : undefined;

          return (
            <div
              key={filepath || states[0]?.streamId}
              className="bg-vsc-input-background/60 flex items-center justify-between gap-3 rounded-lg px-3 py-2"
              data-testid={`pending-apply-file-row-${index}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {filepath ? (
                  <>
                    <FileIcon filename={filepath} height="18px" width="18px" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium">
                          {getUriPathBasename(filepath)}
                        </div>
                        {pathContext && (
                          <span
                            className="bg-vsc-editor-background text-description-muted rounded-full px-2 py-0.5 text-[10px] font-medium"
                            data-testid={`pending-apply-file-path-${index}`}
                          >
                            {pathContext}
                          </span>
                        )}
                      </div>
                      <div className="text-description-muted truncate text-[11px]">
                        {states.length} pending{" "}
                        {states.length === 1 ? "change" : "changes"}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Unsaved file</div>
                    <div className="text-description-muted text-[11px]">
                      {states.length} pending{" "}
                      {states.length === 1 ? "change" : "changes"}
                    </div>
                  </div>
                )}
              </div>

              <AcceptRejectDiffButtons
                applyStates={states}
                testId={`pending-apply-file-actions-${index}`}
                className="px-0"
                onAcceptOrReject={async () => {}}
              />
            </div>
          );
        })}
      </div>

      {!isExpanded && hasOverflow && (
        <div
          className="border-command-border bg-vsc-input-background/30 border-0 border-t border-solid px-3 py-2"
          data-testid="pending-apply-hidden-preview"
        >
          <div className="text-description-muted text-[11px]">
            Hidden until expanded
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {Object.entries(hiddenPreviewGroups).map(
              ([label, count], index) => (
                <span
                  key={label}
                  className="bg-vsc-editor-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium"
                  data-testid={`pending-apply-hidden-group-${index}`}
                >
                  {count > 1 ? `${label} (${count} files)` : label}
                </span>
              ),
            )}
          </div>
        </div>
      )}

      {hasOverflow && (
        <div className="border-command-border flex items-center justify-between gap-3 border-0 border-t border-solid px-3 py-2">
          <div
            className="text-description-muted text-[11px]"
            data-testid="pending-apply-visible-count"
          >
            {isExpanded
              ? `Showing all ${pendingFiles.length} files`
              : `Showing ${visiblePendingFiles.length} of ${pendingFiles.length} files`}
          </div>
          <button
            type="button"
            className="text-link hover:bg-vsc-input-background/60 rounded-md border-none bg-transparent px-2 py-1 text-xs font-medium"
            data-testid="pending-apply-overflow-toggle"
            aria-expanded={isExpanded}
            aria-controls="pending-apply-file-list"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded
              ? "Show fewer files"
              : `Show ${hiddenPendingFilesCount} more files`}
          </button>
        </div>
      )}
    </div>
  );
}
