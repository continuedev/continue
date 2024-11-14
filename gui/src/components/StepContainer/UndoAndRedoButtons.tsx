import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from "@heroicons/react/24/outline";
import { setCurCheckpointIndex } from "../../redux/slices/stateSlice";
import { useContext } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";

export default function UndoAndRedoButtons() {
  const dispatch = useDispatch();
  const ideMessenger = useContext(IdeMessengerContext);

  const checkpoints = useSelector(
    (store: RootState) => store.state.checkpoints,
  );

  const curCheckpointIndex = useSelector(
    (store: RootState) => store.state.curCheckpointIndex,
  );

  const shouldRenderRedo = curCheckpointIndex !== checkpoints.length - 1;

  async function handleUndoOrRedo(type: "undo" | "redo") {
    const checkpointIndex = Math.max(
      0,
      type === "undo" ? curCheckpointIndex - 1 : curCheckpointIndex + 1,
    );

    const checkpoint = checkpoints[checkpointIndex];

    for (const [filepath, prevFileContent] of Object.entries(checkpoint)) {
      console.log({
        filepath,
        prevFileContent,
        checkpointIndex,
        curCheckpointIndex,
      });
      ideMessenger.post("overwriteFile", { filepath, prevFileContent });
    }

    dispatch(setCurCheckpointIndex(checkpointIndex));
  }

  return (
    <div className="flex justify-center gap-2 border-b border-gray-200/25 p-1 px-3">
      <button
        className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
        onClick={() => handleUndoOrRedo("undo")}
      >
        <ArrowUturnLeftIcon className="mr-2 h-3.5 w-3.5" />
        Undo changes
      </button>

      {shouldRenderRedo && (
        <button
          className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
          onClick={() => handleUndoOrRedo("redo")}
        >
          <ArrowUturnRightIcon className="mr-2 h-3.5 w-3.5" />
          Redo changes
        </button>
      )}
    </div>
  );
}
