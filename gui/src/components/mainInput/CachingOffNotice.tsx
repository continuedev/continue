import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import { useNow } from "../../hooks/useNow";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { dismissCachingOffNotice } from "../../redux/slices/sessionSlice";
import { setPromptCacheSetting } from "../../redux/slices/uiSlice";
import { formatTokens, formatUsd } from "../../util/cacheNotices";
import { cachingOffCost } from "../../util/cacheSafeguards";
import { modelSupportsOneHourCache } from "../../util/promptCache";
import { NoticeAction, NoticeBar } from "./NoticeBar";

/**
 * Shown when prompt caching is off and the conversation is big enough that
 * every message pays full price for all of it. Caching is off in Chat unless turned on, so
 * these users are the ones with the most to gain and nothing else to tell them.
 */
export function CachingOffNotice() {
  const dispatch = useAppDispatch();
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const isStreaming = useAppSelector((s) => s.session.isStreaming);
  // Re-check as time passes so a cache that expires is not mistaken for off.
  useNow();

  if (!model || !state || isStreaming || state.dismissedCachingOff) return null;
  const cost = cachingOffCost(model, setting, state);
  if (!cost) return null;

  const per =
    cost.perMessageUsd !== undefined && cost.warmUsd !== undefined
      ? ` Each message costs about ${formatUsd(cost.perMessageUsd)}; with caching on, about ${formatUsd(cost.warmUsd)} while the cache is warm.`
      : "";
  const turnOn = (choice: "auto" | "5m") =>
    dispatch(
      setPromptCacheSetting({ modelTitle: model.title, setting: choice }),
    );

  return (
    <NoticeBar
      testId="caching-off-notice"
      onDismiss={() => dispatch(dismissCachingOffNotice())}
    >
      <span>
        Prompt caching is off, so every message sends all{" "}
        {formatTokens(cost.tokens)} tokens of this conversation at full price.
        {per}
      </span>
      {modelSupportsOneHourCache(model) && (
        <NoticeAction
          testId="caching-off-auto"
          title="Caches for 5 minutes, and for 1 hour once you pause between messages"
          onClick={() => turnOn("auto")}
        >
          Turn on caching (Auto)
        </NoticeAction>
      )}
      <NoticeAction
        testId="caching-off-5m"
        title="Caches for 5 minutes after each message. Writes cost 1.25x the input price."
        onClick={() => turnOn("5m")}
      >
        {modelSupportsOneHourCache(model)
          ? "5 minutes only"
          : "Turn on caching"}
      </NoticeAction>
    </NoticeBar>
  );
}
