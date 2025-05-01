import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { exitEditMode } from "../../redux/thunks/editMode";
import AcceptRejectAllButtons from "../AcceptRejectAllButtons";
import { useMainEditor } from "./TipTapEditor";

const EditModeDetails = () => {
  const isStreaming = useAppSelector((store) => store.session.isStreaming);
  const mode = useAppSelector((store) => store.session.mode);
  const dispatch = useAppDispatch();
  const editApplyState = useAppSelector(
    (store) => store.editModeState.applyState,
  );
  const { mainEditor } = useMainEditor();
  const ideMessenger = useContext(IdeMessengerContext);

  if (mode !== "edit") {
    return null;
  }
  if (isStreaming) {
    return null;
  }
  if (editApplyState.status === "done") {
    const plural = editApplyState.numDiffs === 1 ? "" : "s";
    return (
      <>
        <div className="flex flex-col items-center justify-center pb-1 pt-3 text-xs italic text-gray-400">
          <span className="">{`${editApplyState.numDiffs} diff${plural} remaining`}</span>
        </div>
        <AcceptRejectAllButtons
          applyStates={[editApplyState]}
          onAcceptOrReject={async (outcome) => {
            if (outcome === "acceptDiff") {
              await dispatch(exitEditMode({}));
              ideMessenger.post("focusEditor", undefined);
            } else {
              mainEditor?.commands.focus();
            }
          }}
        />
      </>
    );
  }

  // Will only still show if not all accepted
  if (editApplyState.status === "closed") {
    return (
      <div>
        <span></span>
      </div>
    );
  }

  // Not started/streaming
  return null;
};

export default EditModeDetails;
