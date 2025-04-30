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

  if (isStreaming || mode !== "edit" || editApplyState.status !== "done") {
    return null;
  }

  const plural = editApplyState.numDiffs === 1 ? "" : "s";

  return (
    <>
      <div className="h-2"></div>
      <AcceptRejectAllButtons
        applyStates={[editApplyState]}
        onAcceptOrReject={async (outcome) => {
          if (outcome === "acceptDiff") {
            dispatch(exitEditMode({}));
          }
        }}
      />
      <div className="flex flex-col items-center justify-center pt-2 text-gray-400">
        <span className="">{`${editApplyState.numDiffs} diff${plural} remaining`}</span>
      </div>
    </>
  );
};

export default EditModeDetails;
