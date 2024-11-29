import { BarsArrowDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { stripImages } from "core/llm/images";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import EditActions from "./EditActions";
import FeedbackButtons from "./FeedbackButtons";
import { useAppSelector } from "../../redux/hooks";

export interface ResponseActionsProps {
  isTruncated: boolean;
  onContinueGeneration: () => void;
  index: number;
  onDelete: () => void;
  item: ChatHistoryItem;
}

export default function ResponseActions({
  onContinueGeneration,
  index,
  item,
  isTruncated,
  onDelete,
}: ResponseActionsProps) {
  const isInEditMode = useAppSelector(
    (store) => store.editModeState.isInEditMode,
  );

  if (isInEditMode) {
    return <EditActions index={index} item={item} />;
  }

  return (
    <div className="mx-2 flex cursor-default items-center justify-end space-x-1 pb-0 text-xs text-gray-400">
      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Continue generation"
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="h-3.5 w-3.5 text-gray-500" />
        </HeaderButtonWithToolTip>
      )}

      <HeaderButtonWithToolTip text="Delete" tabIndex={-1} onClick={onDelete}>
        <TrashIcon className="h-3.5 w-3.5 text-gray-500" />
      </HeaderButtonWithToolTip>

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
