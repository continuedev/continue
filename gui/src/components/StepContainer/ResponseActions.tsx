import {
  ArrowsPointingInIcon,
  BarsArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { modelSupportsNativeTools } from "core/llm/toolSupport";
import { renderChatMessage } from "core/util/messageContent";
import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { useCompactConversation } from "../../util/compactConversation";
import { FeedbackButtons } from "../FeedbackButtons";
import { GenerateRuleDialog } from "../GenerateRuleDialog";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const isPruned = useAppSelector((state) => state.session.isPruned);
  const ruleGenerationSupported = useMemo(() => {
    return selectedModel && modelSupportsNativeTools(selectedModel);
  }, [selectedModel]);

  const percent = Math.round((contextPercentage ?? 0) * 100);
  const buttonColorClass =
    isLast && (isPruned || percent > 80)
      ? "text-warning"
      : "text-description-muted";

  const showLabel = isLast && (isPruned || percent >= 60);

  const compactConversation = useCompactConversation();

  const onGenerateRule = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<GenerateRuleDialog />));
  };

  return (
    <div className="text-description-muted mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs">
      <HeaderButtonWithToolTip
        testId={`compact-button-${index}`}
        text={
          showLabel
            ? t("StepContainer.ResponseActions.SummarizeConversation")
            : t("StepContainer.ResponseActions.CompactConversation")
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
              {t("StepContainer.ResponseActions.CompactConversation")}
            </span>
          )}
        </div>
      </HeaderButtonWithToolTip>

      {isLast && ruleGenerationSupported && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text={t("StepContainer.ResponseActions.GenerateRule")}
          onClick={onGenerateRule}
        >
          <PencilSquareIcon className="text-description-muted h-3.5 w-3.5" />
        </HeaderButtonWithToolTip>
      )}

      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text={t("StepContainer.ResponseActions.ContinueGeneration")}
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="text-description-muted h-3.5 w-3.5" />
        </HeaderButtonWithToolTip>
      )}

      <HeaderButtonWithToolTip
        testId={`delete-button-${index}`}
        text={t("StepContainer.ResponseActions.Delete")}
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
