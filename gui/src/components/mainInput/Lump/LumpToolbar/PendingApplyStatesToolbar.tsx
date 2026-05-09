import { ApplyState } from "core";
import { getUriPathBasename } from "core/util/uri";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import FileIcon from "../../../FileIcon";

interface PendingApplyStatesToolbarProps {
  pendingApplyStates: ApplyState[];
}

export function PendingApplyStatesToolbar({
  pendingApplyStates,
}: PendingApplyStatesToolbarProps) {
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

  return (
    <div
      className="bg-vsc-editor-background border-command-border overflow-hidden rounded-xl border border-solid"
      data-testid="pending-apply-rail"
    >
      <div className="border-command-border border-0 border-b border-solid px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Pending edits</div>
            <div className="text-description-muted text-[11px]">
              Review {pendingFiles.length}{" "}
              {pendingFiles.length === 1 ? "file" : "files"} before your next
              send.
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

        <div
          className="mt-2 flex flex-wrap items-center gap-2"
          data-testid="pending-apply-summary"
        >
          <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium">
            {pendingFiles.length} {pendingFiles.length === 1 ? "file" : "files"}
          </span>
          <span className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px] font-medium">
            {totalPendingChanges} pending{" "}
            {totalPendingChanges === 1 ? "change" : "changes"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-2">
        {pendingFiles.map(([filepath, states], index) => (
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
                    <div className="truncate text-sm font-medium">
                      {getUriPathBasename(filepath)}
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
        ))}
      </div>
    </div>
  );
}
