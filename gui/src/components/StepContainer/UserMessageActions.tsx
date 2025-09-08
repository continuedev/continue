import { ArrowTurnRightDownIcon } from "@heroicons/react/24/outline";
import { ChatHistoryItem } from "core";
import { renderChatMessage } from "core/util/messageContent";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { CopyIconButton } from "../gui/CopyIconButton";
import HeaderButtonWithToolTip from "../gui/HeaderButtonWithToolTip";

export interface UserMessageActionsProps {
  index: number;
  item: ChatHistoryItem;
}

export default function UserMessageActions({
  index,
  item,
}: UserMessageActionsProps) {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector((state) => state.session.id);

  const onFork = async () => {
    const { forkSession } = await import("../../redux/thunks/session");
    void dispatch(
      forkSession({
        sessionId,
        upToMessageIndex: index,
      }),
    );
  };

  return (
    <div className="text-description-muted mx-2 flex cursor-default items-center justify-end space-x-1 bg-transparent pb-0 text-xs">
      <HeaderButtonWithToolTip
        testId={`fork-button-${index}`}
        text="Copy and fork from here"
        tabIndex={-1}
        onClick={onFork}
      >
        <ArrowTurnRightDownIcon className="text-description-muted h-3.5 w-3.5" />
      </HeaderButtonWithToolTip>

      <CopyIconButton
        tabIndex={-1}
        text={renderChatMessage(item.message)}
        clipboardIconClassName="h-3.5 w-3.5 text-description-muted"
        checkIconClassName="h-3.5 w-3.5 text-success"
      />
    </div>
  );
}
