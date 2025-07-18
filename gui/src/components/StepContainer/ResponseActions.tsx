import {
  ArrowsPointingInIcon,
  BarsArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { modelSupportsTools } from "core/llm/autodetect";
import { renderChatMessage } from "core/util/messageContent";
import { useContext, useMemo } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setCompactionLoading } from "../../redux/slices/sessionSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { loadSession } from "../../redux/thunks/session";
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
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const currentSessionId = useAppSelector((state) => state.session.id);
  const selectedModel = useAppSelector(selectSelectedChatModel);
  const ruleGenerationSupported = useMemo(() => {
    return selectedModel && modelSupportsTools(selectedModel);
  }, [selectedModel]);

  const onGenerateRule = () => {
    dispatch(setShowDialog(true));
    dispatch(setDialogMessage(<GenerateRuleDialog />));
  };

  const onCompactConversation = async () => {
    if (!currentSessionId) {
      return;
    }

    try {
      // Set loading state
      dispatch(setCompactionLoading({ index, loading: true }));

      await ideMessenger.request("conversation/compact", {
        index,
        sessionId: currentSessionId,
      });

      // Reload the current session to refresh the conversation state
      dispatch(
        loadSession({
          sessionId: currentSessionId,
          saveCurrentSession: false,
        }),
      );
    } catch (error) {
      console.error("Error compacting conversation:", error);
    } finally {
      // Clear loading state
      dispatch(setCompactionLoading({ index, loading: false }));
    }
  };

  return (
    <div className="text-description-muted mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs">
      <HeaderButtonWithToolTip
        testId={`compact-button-${index}`}
        text="Compact conversation"
        tabIndex={-1}
        onClick={onCompactConversation}
      >
        <ArrowsPointingInIcon className="text-description-muted h-3.5 w-3.5" />
      </HeaderButtonWithToolTip>

      {isLast && ruleGenerationSupported && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Generate rule"
          onClick={onGenerateRule}
        >
          <PencilSquareIcon className="text-description-muted h-3.5 w-3.5" />
        </HeaderButtonWithToolTip>
      )}

      {isTruncated && (
        <HeaderButtonWithToolTip
          tabIndex={-1}
          text="Continue generation"
          onClick={onContinueGeneration}
        >
          <BarsArrowDownIcon className="text-description-muted h-3.5 w-3.5" />
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
