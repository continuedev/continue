import { selectCacheSetting } from "../redux/selectors/selectCacheSetting";
import { useNow } from "./useNow";
import { useAppSelector } from "../redux/hooks";
import { selectSelectedChatModel } from "../redux/slices/configSlice";
import { formatTokens } from "../util/cacheNotices";
import { isSignificantLoss, warmCacheLoss } from "../util/cacheSafeguards";

/**
 * A sentence for the "Compact conversation" actions while the prompt cache
 * holds a conversation big enough to matter. Compacting replaces the history
 * with a summary: the summary request itself reads the cache, but the cached
 * conversation is then of no use, and going back to the full history means
 * reading all of it again. Empty otherwise.
 */
export function useCompactionCacheNote(): string {
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const now = useNow();
  if (!model || !state) return "";
  const loss = warmCacheLoss(model, setting, state, now);
  if (!loss || !isSignificantLoss(loss)) return "";
  const where = loss.local ? "the model server's cache" : "the prompt cache";
  return `This conversation (${formatTokens(loss.tokens)} tokens) is in ${where}. Compacting replaces it with a summary: later messages are smaller, but what the summary leaves out is gone, and the cached conversation is dropped.`;
}
