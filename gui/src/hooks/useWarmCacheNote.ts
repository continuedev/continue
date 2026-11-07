import { selectCacheSetting } from "../redux/selectors/selectCacheSetting";
import { useNow } from "./useNow";
import { useAppSelector } from "../redux/hooks";
import { selectSelectedChatModel } from "../redux/slices/configSlice";
import { formatRereadCost } from "../util/cacheNotices";
import { isSignificantLoss, warmCacheLoss } from "../util/cacheSafeguards";

/**
 * A sentence for the places where a change rebuilds the prompt cache (the
 * reasoning switch, attaching an image, turning a tool or MCP server on or
 * off): while the cache is warm and the conversation is big enough to matter,
 * it says what the next message will cost. Empty otherwise.
 */
export function useWarmCacheNote(): string {
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const now = useNow();
  if (!model || !state) return "";
  const loss = warmCacheLoss(model, setting, state, now);
  if (!loss || !isSignificantLoss(loss)) return "";
  return `Prompt cache is warm: changing this re-reads ${formatRereadCost(loss)}.`;
}
