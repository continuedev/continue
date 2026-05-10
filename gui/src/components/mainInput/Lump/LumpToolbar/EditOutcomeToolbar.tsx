import { useContext } from "react";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks";
import { exitEdit } from "../../../../redux/thunks/edit";
import AcceptRejectDiffButtons from "../../../AcceptRejectDiffButtons";
import { useMainEditor } from "../../TipTapEditor";
import { getEditFilenameAndRangeText } from "../../util";

export function EditOutcomeToolbar() {
  const dispatch = useAppDispatch();
  const editApplyState = useAppSelector(
    (store) => store.editModeState.applyState,
  );
  const codeToEdit = useAppSelector(
    (store) => store.editModeState.codeToEdit[0],
  );
  const { mainEditor } = useMainEditor();
  const ideMessenger = useContext(IdeMessengerContext);
  const diffCountLabel = `${editApplyState.numDiffs} diff${editApplyState.numDiffs !== 1 ? "s" : ""}`;
  const editTargetLabel = codeToEdit
    ? getEditFilenameAndRangeText(codeToEdit)
    : "your current edit";

  return (
    <div
      className="bg-vsc-editor-background border-command-border flex items-center justify-between gap-3 rounded-lg border border-solid px-3 py-2 text-xs"
      data-testid="edit-outcome-toolbar"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">Review edit outcome</div>
        <div
          className="text-description-muted truncate text-[11px]"
          data-testid="edit-outcome-target"
        >
          {`Keep or Undo ${diffCountLabel} in ${editTargetLabel} before returning to chat.`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="bg-vsc-input-background text-description max-w-[8rem] truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
          data-testid="edit-outcome-diff-count"
          title={editTargetLabel}
        >
          {editTargetLabel}
        </span>
        <AcceptRejectDiffButtons
          applyStates={[editApplyState]}
          onAcceptOrReject={async (outcome) => {
            if (outcome === "acceptDiff") {
              await dispatch(exitEdit({}));
              ideMessenger.post("focusEditor", undefined);
            } else {
              mainEditor?.commands.focus();
            }
          }}
        />
      </div>
    </div>
  );
}
