import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { useNow } from "../../hooks/useNow";
import { warmCacheLoss } from "../../util/cacheSafeguards";
import { formatTokens, formatUsd } from "../../util/cacheNotices";

/**
 * One line in the mode menu while the prompt cache is warm. Each mode has its
 * own system prompt and tool list, and the cache is built from the start of
 * the prompt, so changing mode rebuilds it.
 */
export function ModeSwitchCacheNotice() {
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const now = useNow();
  if (!model || !state) return null;
  const loss = warmCacheLoss(model, setting, state, now);
  if (!loss) return null;
  const cost =
    loss.extraUsd !== undefined
      ? ` (about ${formatUsd(loss.extraUsd)} more)`
      : "";
  return (
    <div
      className="border-0 border-t border-solid border-t-border px-2 py-1 text-[10px] text-description-muted"
      data-testid="mode-switch-cache-notice"
    >
      Prompt cache is warm. Another mode has its own system prompt and tools, so
      switching re-reads {formatTokens(loss.tokens)} tokens at full price{cost}.
    </div>
  );
}
