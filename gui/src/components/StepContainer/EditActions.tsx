import { ChatHistoryItem } from "core";

import { renderChatMessage } from "core/util/messageContent";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { exitEditMode } from "../../redux/thunks/editMode";
import AcceptRejectAllButtons from "../AcceptRejectAllButtons";
import FeedbackButtons from "../FeedbackButtons";
import { CopyIconButton } from "../gui/CopyIconButton";

export interface EditActionsProps {
  index: number;
  item: ChatHistoryItem;
}

export default function EditActions({ index, item }: EditActionsProps) {
  const dispatch = useAppDispatch();

  const applyState = useAppSelector((store) => store.editModeState.applyState);

  if (
    applyState.status === "not-started" ||
    applyState.status === "streaming"
  ) {
    return null;
  }
  return (
    <div
      className={`mx-2 mb-2 mt-2 flex h-7 items-center justify-between pb-0 text-xs text-gray-400`}
    >
      <div className="flex-1" />

      <div className="flex-2 flex justify-center">
        {applyState.status === "done" && (
          <AcceptRejectAllButtons
            pendingApplyStates={[applyState]}
            onAcceptOrReject={async (outcome) => {
              if (outcome === "acceptDiff") {
                dispatch(exitEditMode({}));
              }
            }}
          />
        )}
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
