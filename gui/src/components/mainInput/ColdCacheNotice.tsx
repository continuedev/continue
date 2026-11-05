import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import { useCompactConversation } from "../../util/compactConversation";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { useNow } from "../../hooks/useNow";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { dismissColdCacheNotice } from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { saveCurrentSession } from "../../redux/thunks/session";
import { coldResume } from "../../util/cacheSafeguards";
import { formatIdle, formatTokens, formatUsd } from "../../util/cacheNotices";
import { modelSupportsOneHourCache } from "../../util/promptCache";
import { NoticeAction, NoticeBar } from "./NoticeBar";

/**
 * Shown above the input when the prompt cache has expired and the next message
 * would re-read a large conversation at full price. It does not block sending.
 */
export function ColdCacheNotice() {
  const dispatch = useAppDispatch();
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const history = useAppSelector((s) => s.session.history);
  const isStreaming = useAppSelector((s) => s.session.isStreaming);
  const now = useNow();
  const compact = useCompactConversation();

  if (!model || !state || isStreaming || history.length === 0) return null;
  const cold = coldResume(model, setting, state, now);
  if (!cold || state.dismissedColdFor === state.lastRequestAt) return null;

  const dismiss = () =>
    dispatch(dismissColdCacheNotice(state.lastRequestAt ?? 0));
  const canUseOneHour =
    setting !== "1h" &&
    setting !== undefined &&
    modelSupportsOneHourCache(model);
  const cost =
    cold.extraUsd !== undefined
      ? ` (about ${formatUsd(cold.extraUsd)} more)`
      : "";

  return (
    <NoticeBar testId="cold-cache-notice" onDismiss={dismiss}>
      <span>
        Prompt cache expired {formatIdle(cold.idleMs)} ago. Sending re-reads{" "}
        {formatTokens(cold.tokens)} tokens at full price{cost}.
      </span>
      <NoticeAction
        testId="cold-cache-compact"
        title="Summarizes the conversation. The summary request reads the whole conversation once, then later messages carry only the summary."
        onClick={() => {
          dismiss();
          void compact(history.length - 1);
        }}
      >
        Compact first
      </NoticeAction>
      <NoticeAction
        testId="cold-cache-new-session"
        title="Saves this session and starts an empty one"
        onClick={() =>
          void dispatch(
            saveCurrentSession({ openNewSession: true, generateTitle: false }),
          )
        }
      >
        New session
      </NoticeAction>
      {canUseOneHour && (
        <NoticeAction
          testId="cold-cache-one-hour"
          title="Keeps the cache for an hour after each message. Writes cost 2x instead of 1.25x."
          onClick={() =>
            dispatch(
              setPromptCacheSetting({ modelTitle: model.title, setting: "1h" }),
            )
          }
        >
          Use 1 hour cache
        </NoticeAction>
      )}
    </NoticeBar>
  );
}
