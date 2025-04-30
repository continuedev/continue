import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { exitEditMode } from "../../redux/thunks/editMode";
import AcceptRejectAllButtons from "../AcceptRejectAllButtons";

const EditModeDetails = () => {
  const isStreaming = useAppSelector((store) => store.session.isStreaming);
  const mode = useAppSelector((store) => store.session.mode);
  const dispatch = useAppDispatch();
  const editApplyState = useAppSelector(
    (store) => store.editModeState.applyState,
  );

  if (isStreaming || mode !== "edit") {
    return null;
  }
  return (
    <AcceptRejectAllButtons
      applyStates={[editApplyState]}
      onAcceptOrReject={async (outcome) => {
        if (outcome === "acceptDiff") {
          dispatch(exitEditMode({}));
        }
      }}
    />
  );
};

export default EditModeDetails;
