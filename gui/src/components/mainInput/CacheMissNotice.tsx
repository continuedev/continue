import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { acknowledgeCacheMisses } from "../../redux/slices/sessionSlice";
import { formatTokens } from "../../util/cacheNotices";
import {
  MISS_NOTICE_AFTER,
  MISS_NOTICE_AFTER_LOCAL,
} from "../../util/cacheSafeguards";
import { modelUsesLocalPrefixCache } from "../../util/promptCache";
import { NoticeBar } from "./NoticeBar";

/**
 * Shown after repeated requests that should have read the prompt cache and
 * mostly did not. In a healthy session this never appears, so it is also a
 * warning that something at the start of the prompt keeps changing.
 */
export function CacheMissNotice() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.session.promptCache);
  const model = useAppSelector(selectSelectedChatModel);
  if (!state?.lastMiss) return null;
  // On a local server each miss costs minutes of reading, so say it at once
  const local = modelUsesLocalPrefixCache(model);
  const unseen = (state.misses ?? 0) - (state.missesAcknowledged ?? 0);
  if (unseen < (local ? MISS_NOTICE_AFTER_LOCAL : MISS_NOTICE_AFTER)) {
    return null;
  }

  const { readTokens, expectedTokens, causes } = state.lastMiss;
  const why =
    causes.length > 0
      ? `Likely cause: ${causes.join("; ")}.`
      : local
        ? "Nothing the app controls changed, so the server likely lost the conversation: it unloaded the model after being idle, or another conversation (a subagent, another session or another app) took its cache."
        : "Nothing the app controls changed, so the provider may not be caching this prompt, or something earlier in it keeps changing (tools, MCP servers or rules).";

  return (
    <NoticeBar
      testId="cache-miss-notice"
      onDismiss={() => dispatch(acknowledgeCacheMisses())}
    >
      <span>
        The prompt cache missed {unseen === 1 ? "once" : `${unseen} times`} in
        this session. The last request read {formatTokens(readTokens)} of{" "}
        {formatTokens(expectedTokens)} tokens. {why}
      </span>
    </NoticeBar>
  );
}
