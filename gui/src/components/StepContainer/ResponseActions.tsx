import {
  ArrowsPointingInIcon,
  ArrowUturnLeftIcon,
  BarsArrowDownIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { hasCheckpointsFrom } from "core/util/checkpoints";
import { renderChatMessage } from "core/util/messageContent";
import { useAppSelector } from "../../redux/hooks";
import { useCompactConversation } from "../../util/compactConversation";
import {
  findTurnIdForIndex,
  getTurnOrder,
  useRestoreCheckpoint,
} from "../../util/restoreCheckpoint";
import { FeedbackButtons } from "../FeedbackButtons";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

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
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const isPruned = useAppSelector((state) => state.session.isPruned);

  const percent = Math.round((contextPercentage ?? 0) * 100);
  const buttonColorClass =
    isLast && (isPruned || percent > 80)
      ? "text-warning"
      : "text-description-muted";

  const showLabel = isLast && (isPruned || percent >= 60);

  const compactConversation = useCompactConversation();

  // The turn this response belongs to, if an agent edit during or after it
  // has a checkpoint to roll back
  const restorableTurnId = useAppSelector((state) => {
    const turnId = findTurnIdForIndex(state.session.history, index);
    return turnId &&
      hasCheckpointsFrom(
        state.session.checkpoints,
        getTurnOrder(state.session.history),
        turnId,
      )
      ? turnId
      : undefined;
  });
  const restoreToTurn = useRestoreCheckpoint();

  return (
    <div className="mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs text-description-muted">
      <HeaderButtonWithToolTip
        testId={`compact-button-${index}`}
        text={
          showLabel
            ? "Summarize conversation to reduce context length"
            : "Compact conversation"
        }
        tabIndex={-1}
        onClick={() => compactConversation(index)}
      >
        <div className="flex items-center space-x-1">
          <ArrowsPointingInIcon
            className={`h-3.5 w-3.5 ${buttonColorClass || "text-description-muted"}`}
          />
          {showLabel && (
            <span
              className={`text-xs ${buttonColorClass || "text-description-muted"}`}
            >
              Compact conversation
            </span>
          )}
        </div>
      </HeaderButtonWithToolTip>

      {restorableTurnId && (
        <HeaderButtonWithToolTip
          testId={`restore-checkpoint-button-${index}`}
          text="Restore files to before this turn"
          tabIndex={-1}
          onClick={() => void restoreToTurn(restorableTurnId)}
        >
          <ArrowUturnLeftIcon className="h-3.5 w-3.5 text-description-muted" />
        </HeaderButtonWithToolTip>
      )}

      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Continue generation"
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="h-3.5 w-3.5 text-description-muted" />
        </HeaderButtonWithToolTip>
      )}

      <HeaderButtonWithToolTip
        testId={`delete-button-${index}`}
        text="Delete"
        tabIndex={-1}
        onClick={onDelete}
      >
        <TrashIcon className="h-3.5 w-3.5 text-description-muted" />
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
