import { BarsArrowDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/store";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import FeedbackButtons from "./FeedbackButtons";
import MultifileEditActions from "./MultifileEditActions";

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
  const isInMultifileEdit = useSelector(
    (store: RootState) => store.state.isMultifileEdit,
  );

  // Only render delete button if there is more than one message
  const shouldRenderDelete = index !== 1;

  if (isInMultifileEdit) {
    return <MultifileEditActions index={index} item={item} />;
  }

  return (
    <div className="mx-2 flex h-7 cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs text-gray-400">
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
        text={renderChatMessage(item.message)}
        clipboardIconClassName="h-3.5 w-3.5 text-gray-500"
        checkIconClassName="h-3.5 w-3.5 text-green-400"
      />

      <FeedbackButtons item={item} />
    </div>
  );
}
