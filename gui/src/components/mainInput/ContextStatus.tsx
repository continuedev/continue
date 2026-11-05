import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import { useMemo, useRef } from "react";
import { useNow } from "../../hooks/useNow";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { saveCurrentSession } from "../../redux/thunks/session";
import {
  contextMeterTokens,
  formatTokens,
  formatUsd,
  longContextNote,
  perMessageCost,
  QUALITY_NOTE,
} from "../../util/cacheNotices";
import { useCompactConversation } from "../../util/compactConversation";
import { promptCacheStatus } from "../../util/promptCache";
import { ToolTip } from "../gui/Tooltip";

const ContextStatus = () => {
  const dispatch = useAppDispatch();
  const contextPercentage = useAppSelector(
    (state) => state.session.contextPercentage,
  );
  const selectedChatModel = useAppSelector(
    (state) => state.config.config.selectedModelByRole.chat?.model,
  );
  const previousHistoryLength = useRef<number | null>(null);
  const previousSelectedChatModel = useRef<string | null>(null);
  const history = useAppSelector((state) => state.session.history);
  const percent = Math.round((contextPercentage ?? 0) * 100);
  const isPruned = useAppSelector((state) => state.session.isPruned);

  const isDifferentModelAndSameHistory = useMemo(() => {
    if (!selectedChatModel) return false;
    // only reset if history changes
    if (previousHistoryLength.current !== history.length) {
      previousHistoryLength.current = history.length;
      previousSelectedChatModel.current = selectedChatModel;
      return false;
    }
    return previousSelectedChatModel.current !== selectedChatModel;
  }, [history.length, selectedChatModel]);

  const compactConversation = useCompactConversation();
  const model = useAppSelector(selectSelectedChatModel);
  const cacheSetting = useAppSelector(selectCacheSetting);
  const cacheState = useAppSelector((state) => state.session.promptCache);
  const now = useNow();

  // The share of the window says little on a 1M model, so also show from a
  // fixed size: that is where each message starts to cost real money.
  const tokens = cacheState?.lastInputTokens ?? 0;
  const isLarge = !!model && tokens >= contextMeterTokens(model);
  if (!isPruned && percent < 60 && !isLarge) {
    return null;
  }

  // if user changed to a different model, we shouldn't show the context status until the user sends a new message
  if (isDifferentModelAndSameHistory) {
    return null;
  }

  const barColorClass = isPruned ? "bg-error" : "bg-description";
  const cost =
    model && isLarge
      ? perMessageCost(
          model,
          tokens,
          promptCacheStatus(
            model,
            cacheSetting,
            cacheState ?? { escalated: false },
            now,
          ).ttl,
        )
      : undefined;
  const longNote =
    model && isLarge ? longContextNote(model, tokens) : undefined;

  return (
    <div>
      <ToolTip
        closeEvents={{
          // blur: false,
          mouseleave: true,
          click: true,
          mouseup: false,
        }}
        clickable
        content={
          <div className="flex flex-col gap-0 text-left text-xs">
            <span className="inline-block">
              {`${percent}% of context filled.`}
            </span>
            {isLarge && (
              <span className="inline-block" data-testid="context-size-note">
                {`${formatTokens(tokens)} tokens are sent with every message.`}
                {cost &&
                  ` One more message costs about ${formatUsd(cost.warmUsd)} with the prompt cache warm and ${formatUsd(cost.coldUsd)} after it expires.`}
              </span>
            )}
            {isLarge && (
              <span className="inline-block" data-testid="context-quality-note">
                {QUALITY_NOTE}
              </span>
            )}
            {longNote && (
              <span className="inline-block" data-testid="long-context-note">
                {longNote}
              </span>
            )}
            {isPruned && (
              <span className="inline-block">
                {`Oldest messages are being removed.`}
              </span>
            )}
            {history.length > 0 && (
              <div className="flex flex-col gap-1 whitespace-pre">
                <div>
                  <span
                    className="inline-block cursor-pointer underline hover:text-link"
                    onClick={() => compactConversation(history.length - 1)}
                  >
                    Compact conversation
                  </span>
                  {"\n"}
                  <span
                    className="inline-block cursor-pointer underline hover:text-link"
                    onClick={() => {
                      void dispatch(
                        saveCurrentSession({
                          openNewSession: true,
                          generateTitle: false,
                        }),
                      );
                    }}
                  >
                    Start a new session
                  </span>
                </div>
              </div>
            )}
          </div>
        }
      >
        <div className="relative h-[14px] w-[7px] rounded-[1px] border-[0.5px] border-solid border-command-border md:h-[10px] md:w-[5px]">
          <div
            className={`transition-height absolute bottom-0 left-0 w-full duration-300 ease-in-out ${barColorClass}`}
            style={{ height: `${percent}%` }}
          />
        </div>
      </ToolTip>
    </div>
  );
};

export default ContextStatus;
