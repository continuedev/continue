import { BarsArrowDownIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import EditActions from "./EditActions";
import FeedbackButtons from "./FeedbackButtons";
import { useAppSelector } from "../../redux/hooks";
import { selectIsInEditMode } from "../../redux/slices/sessionSlice";

export interface ResponseActionsProps {
  isTruncated: boolean;
  onContinueGeneration: () => void;
  index: number;
  onDelete: () => void;
  item: ChatHistoryItem;
  shouldHideActions: boolean;
}

export default function ResponseActions({
  onContinueGeneration,
  index,
  item,
  isTruncated,
  onDelete,
  shouldHideActions,
}: ResponseActionsProps) {
  const isInEditMode = useAppSelector(selectIsInEditMode);

  if (isInEditMode) {
    return <EditActions index={index} item={item} />;
  }

  return (
    <div className="text-description mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs">
      {shouldHideActions || (
        <>
          {isTruncated && (
            <HeaderButtonWithToolTip
              tabIndex={-1}
              text="Continue generation"
              onClick={onContinueGeneration}
            >
              <BarsArrowDownIcon className="text-description h-3.5 w-3.5" />
            </HeaderButtonWithToolTip>
          )}

          <HeaderButtonWithToolTip
            testId={`delete-button-${index}`}
            text="Delete"
            tabIndex={-1}
            onClick={onDelete}
          >
            <TrashIcon className="text-description h-3.5 w-3.5" />
          </HeaderButtonWithToolTip>

          <CopyIconButton
            tabIndex={-1}
            text={renderChatMessage(item.message)}
            clipboardIconClassName="h-3.5 w-3.5 text-description"
            checkIconClassName="h-3.5 w-3.5 text-success"
          />

          <FeedbackButtons item={item} />
        </>
      )}
    </div>
  );
}
