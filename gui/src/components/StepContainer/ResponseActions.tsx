import {
  BarsArrowDownIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { useDispatch } from "react-redux";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { FeedbackButtons } from "../FeedbackButtons";
import { GenerateRuleDialog } from "../GenerateRuleDialog";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

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
  const dispatch = useDispatch();

  const onGenerateRule = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<GenerateRuleDialog />));
  };

  return (
    <div className="text-description-muted mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs">
      <div
        className="mr-1 border-y-0 border-l-0 border-r border-solid pr-2"
        onClick={onGenerateRule}
      >
        <span className="flex cursor-pointer items-center hover:brightness-125">
          <PlusIcon className="mr-1 h-3 w-3" />
          <span className="whitespace-nowrap">Generate rule</span>
        </span>
      </div>

      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Continue generation"
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="h-3.5 w-3.5" />
        </HeaderButtonWithToolTip>
      )}

      <HeaderButtonWithToolTip
        testId={`delete-button-${index}`}
        text="Delete"
        tabIndex={-1}
        onClick={onDelete}
      >
        <TrashIcon className="text-description-muted h-3.5 w-3.5" />
      </HeaderButtonWithToolTip>

      <CopyIconButton
        tabIndex={-1}
        text={renderChatMessage(item.message)}
        clipboardIconClassName="h-3.5 w-3.5 text-description-muted"
        checkIconClassName="h-3.5 w-3.5 text-success"
      />

      <FeedbackButtons item={item} />
    </div>
  );
}
