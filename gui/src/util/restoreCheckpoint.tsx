import {
  applyRestore,
  planRestore,
  previewRestore,
  pruneCheckpointsFrom,
  RestoreItem,
} from "core/util/checkpoints";
import { findUriInDirs } from "core/util/uri";
import { useContext } from "react";
import { useStore } from "react-redux";
import ConfirmationDialog from "../components/dialogs/ConfirmationDialog";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useAppDispatch } from "../redux/hooks";
import { setCheckpoints } from "../redux/slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../redux/slices/uiSlice";
import { RootState } from "../redux/store";

const ACTION_LABELS: Record<RestoreItem["action"], string> = {
  restore: "Restore",
  recreate: "Recreate (deleted since)",
  delete: "Delete (created by the agent)",
  unrestorable: "Cannot restore, left as is",
};

type History = RootState["session"]["history"];

/** User message ids in conversation order; the "turns" checkpoints belong to. */
export function getTurnOrder(history: History): string[] {
  return history
    .filter((item) => item.message.role === "user")
    .map((item) => item.message.id);
}

/** The turn (user message id) that the message at `index` belongs to. */
export function findTurnIdForIndex(
  history: History,
  index: number,
): string | undefined {
  for (let i = index; i >= 0; i--) {
    if (history[i]?.message.role === "user") {
      return history[i].message.id;
    }
  }
  return undefined;
}

export function describeRestoreItems(
  items: RestoreItem[],
  workspaceDirs: string[],
): string {
  return items
    .map((item) => {
      let name = item.uri;
      try {
        name = findUriInDirs(item.uri, workspaceDirs).relativePathOrBasename;
      } catch {
        // keep the raw uri
      }
      return `${ACTION_LABELS[item.action]}: ${name}`;
    })
    .join("\n");
}

/**
 * Returns a function that rewinds files to their state before the given turn,
 * after the user confirms the list of files that will change.
 */
export function useRestoreCheckpoint() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const store = useStore<RootState>();

  function showDialog(props: Parameters<typeof ConfirmationDialog>[0]) {
    dispatch(setDialogMessage(<ConfirmationDialog {...props} />));
    dispatch(setShowDialog(true));
  }

  return async function restoreToTurn(turnId: string) {
    const ide = ideMessenger.ide;
    const { checkpoints, history } = store.getState().session;
    const turnOrder = getTurnOrder(history);
    const items = await previewRestore(
      ide,
      planRestore(checkpoints, turnOrder, turnId),
    );
    if (items.length === 0) {
      showDialog({
        title: "Restore files",
        text: "No files need to change. They already match their state before this turn.",
        hideCancelButton: true,
        confirmText: "OK",
        onConfirm: () => {},
      });
      return;
    }
    const workspaceDirs = await ide.getWorkspaceDirs();
    showDialog({
      title: "Restore to here?",
      text: `Files will be put back to how they were before this turn. Later changes to them are lost. Changes made by terminal commands are not tracked.\n\n${describeRestoreItems(items, workspaceDirs)}`,
      confirmText: "Restore",
      onConfirm: async () => {
        const result = await applyRestore(ide, items);
        dispatch(
          setCheckpoints(pruneCheckpointsFrom(checkpoints, turnOrder, turnId)),
        );
        if (result.failed.length) {
          showDialog({
            title: "Some files were not restored",
            text: result.failed.map((f) => `${f.uri}: ${f.error}`).join("\n"),
            hideCancelButton: true,
            confirmText: "OK",
            onConfirm: () => {},
          });
        }
      },
    });
  };
}
