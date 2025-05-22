import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { exitEdit } from "../../redux/thunks/edit";
import AcceptRejectDiffButtons from "../AcceptRejectDiffButtons";
import { useMainEditor } from "./TipTapEditor";

const EditModeDetails = () => {
  const isStreaming = useAppSelector((store) => store.session.isStreaming);
  const dispatch = useAppDispatch();
  const editApplyState = useAppSelector(
    (store) => store.editModeState.applyState,
  );
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const { mainEditor } = useMainEditor();
  const ideMessenger = useContext(IdeMessengerContext);

  if (!isInEdit) {
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
