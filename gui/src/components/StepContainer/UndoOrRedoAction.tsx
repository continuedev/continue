import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import { ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { useApplyCodeBlock } from "../../hooks/useApplyCodeBlock";
import { setCurCheckpointIndex } from "../../redux/slices/stateSlice";

export interface UndoOrRedoActionProps {
  index: number;
}

export default function UndoOrRedoAction({ index }: UndoOrRedoActionProps) {
  const dispatch = useDispatch();
  const applyCodeBlock = useApplyCodeBlock();

  const checkpoints = useSelector(
    (store: RootState) => store.state.checkpoints,
  );

  const prevCheckpointIndex = useSelector(
    (store: RootState) => store.state.curCheckpointIndex - 1,
  );

  const prevCheckpoint = checkpoints[prevCheckpointIndex];

  // // `index` is the 0-based index of history items we map over in the step container.
  // // This converts that index our checkpoint indices, e.g. first chat message becomes zeroth checkpoint
  // const checkpointsIndex = Math.floor(index / 2);
  // const checkpoint = checkpoints[checkpointsIndex];

  async function handleUndo() {
    console.log({ prevCheckpointIndex, checkpoints, prevCheckpoint });

    for (const [filepath, codeBlockContent] of Object.entries(prevCheckpoint)) {
      debugger;
      await applyCodeBlock({
        filepath,
        codeBlockContent,
        overwriteFileContents: true,
      });
    }

    dispatch(setCurCheckpointIndex(prevCheckpointIndex));
  }

  return (
    <button
      className="flex cursor-pointer items-center border-none bg-transparent px-2 py-1 text-xs text-gray-300 opacity-80 hover:opacity-100 hover:brightness-125"
      onClick={handleUndo}
    >
      <ArrowUturnLeftIcon className="mr-2 h-3.5 w-3.5" />
      Undo changes
    </button>
  );
}
