import { ChatHistoryItem } from "core";
import AcceptRejectAllButtons from "./AcceptRejectAllButtons";
import FeedbackButtons from "./FeedbackButtons";

import { renderChatMessage } from "core/util/messageContent";
import { CopyIconButton } from "../gui/CopyIconButton";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import useHistory from "../../hooks/useHistory";
import { exitEditMode } from "../../redux/thunks/exitEditMode";

export interface EditActionsProps {
  index: number;
  item: ChatHistoryItem;
}

export default function EditActions({ index, item }: EditActionsProps) {
  // const curCheckpointIndex = useSelector(
  //   (store: RootState) => store.state.curCheckpointIndex,
  // );
  const dispatch = useAppDispatch();
  const { loadLastSession } = useHistory(dispatch);

  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  const applyStates = useAppSelector(
    (state) => state.session.codeBlockApplyStates.states,
  );

  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );

  const hasClosedAllStreams = applyStates.every(
    (state) => state.status === "closed",
  );

  // const isCurCheckpoint = Math.floor(index / 2) === curCheckpointIndex;
  const hasPendingApplies = pendingApplyStates.length > 0;

  if (isStreaming) return;

  return (
    <div
      className={`mx-2 mb-2 mt-2 flex h-7 items-center justify-between pb-0 text-xs text-gray-400`}
    >
      <div className="flex-1" />

      {/* {isCurCheckpoint && (
        <div className="flex-2 flex justify-center">
          {hasPendingApplies && (
            <AcceptRejectAllButtons pendingApplyStates={pendingApplyStates} />
          )}
          {hasClosedAllStreams && <UndoAndRedoButtons />}
        </div>
      )} */}

      <div className="flex-2 flex justify-center">
        {hasPendingApplies && (
          <AcceptRejectAllButtons
            pendingApplyStates={pendingApplyStates}
            onAcceptOrReject={(outcome) => {
              if (outcome === "acceptDiff") {
                loadLastSession().catch((e) =>
                  console.error(`Failed to load last session: ${e}`),
                );

                dispatch(exitEditMode());
              }
            }}
          />
        )}
        {/* {hasClosedAllStreams && <UndoAndRedoButtons />} */}
      </div>

      <div className="flex flex-1 justify-end">
        <CopyIconButton
          tabIndex={-1}
          text={renderChatMessage(item.message)}
          clipboardIconClassName="h-3.5 w-3.5 text-gray-500"
          checkIconClassName="h-3.5 w-3.5 text-green-400"
        />

        <FeedbackButtons item={item} />
      </div>
    </div>
  );
}
