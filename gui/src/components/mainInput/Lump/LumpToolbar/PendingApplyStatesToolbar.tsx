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

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(applyStatesByFilepath).map(([filepath, states]) => (
        <div key={filepath} className="flex justify-between gap-3">
          {filepath && (
            <span className="bg-badge flex items-center gap-1 rounded px-0.5">
              <FileIcon filename={filepath} height="18px" width="18px" />
              {getUriPathBasename(filepath)}
            </span>
          )}
          <AcceptRejectDiffButtons
            applyStates={states}
            onAcceptOrReject={async () => {}}
          />
        </div>
      ))}
    </div>
  );
}
