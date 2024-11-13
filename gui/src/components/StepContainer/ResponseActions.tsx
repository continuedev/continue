import { BarsArrowDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { stripImages } from "core/llm/images";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import { ChatHistoryItem } from "core";
import UndoOrRedoAction from "./UndoOrRedoAction";
import AcceptRejectAllButtons from "./AcceptRejectAllButtons";
import FeedbackButtons from "./FeedbackButtons";

export interface ResponseActionsProps {
  isTruncated: boolean;
  onContinueGeneration: () => void;
  index: number;
  onDelete: () => void;
  item: ChatHistoryItem;
  isLast: boolean;
}

export default function ResponseActions({
  onContinueGeneration,
  index,
  item,
  isTruncated,
  onDelete,
  isLast,
}: ResponseActionsProps) {
  const isInMultifileEdit = useSelector(
    (store: RootState) => store.state.isMultifileEdit,
  );

  const applyStates = useSelector(
    (state: RootState) => state.state.applyStates,
  );

  const pendingApplyStates = applyStates.filter(
    (state) => state.status === "done",
  );

  const isStreaming = applyStates.some((state) => state.status === "streaming");
  console.log({
    applyStates,
  });

  // Only render delete button if there is more than one message
  const shouldRenderDelete = index !== 1;

  if (isInMultifileEdit) {
    return (
      <div
        className={`mx-2 mb-2 mt-2 flex h-7 items-center justify-between pb-0 text-xs text-gray-400`}
      >
        <div className="flex-1" />

        {isLast && !isStreaming && (
          <div className="flex-2 flex justify-center">
            {pendingApplyStates.length > 0 ? (
              <AcceptRejectAllButtons pendingApplyStates={pendingApplyStates} />
            ) : (
              <UndoOrRedoAction index={index} />
            )}
          </div>
        )}

        <div className="flex flex-1 justify-end">
          <FeedbackButtons item={item} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2 flex h-7 cursor-default items-center justify-end space-x-1 pb-0 text-xs text-gray-400">
      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Continue generation"
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="h-3.5 w-3.5 text-gray-500" />
        </HeaderButtonWithToolTip>
      )}

      {shouldRenderDelete && (
        <HeaderButtonWithToolTip text="Delete" tabIndex={-1} onClick={onDelete}>
          <TrashIcon className="h-3.5 w-3.5 text-gray-500" />
        </HeaderButtonWithToolTip>
      )}

      <CopyIconButton
        tabIndex={-1}
        text={stripImages(item.message.content)}
        clipboardIconClassName="h-3.5 w-3.5 text-gray-500"
        checkIconClassName="h-3.5 w-3.5 text-green-400"
      />

      <FeedbackButtons item={item} />
    </div>
  );
}
