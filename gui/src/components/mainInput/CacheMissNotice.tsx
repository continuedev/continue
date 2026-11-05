import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { acknowledgeCacheMisses } from "../../redux/slices/sessionSlice";
import { formatTokens } from "../../util/cacheNotices";
import { MISS_NOTICE_AFTER } from "../../util/cacheSafeguards";
import { NoticeBar } from "./NoticeBar";

/**
 * Shown after repeated requests that should have read the prompt cache and
 * mostly did not. In a healthy session this never appears, so it is also a
 * warning that something at the start of the prompt keeps changing.
 */
export function CacheMissNotice() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.session.promptCache);
  if (!state?.lastMiss) return null;
  const unseen = (state.misses ?? 0) - (state.missesAcknowledged ?? 0);
  if (unseen < MISS_NOTICE_AFTER) return null;

  const { readTokens, expectedTokens, causes } = state.lastMiss;
  const why =
    causes.length > 0
      ? `Likely cause: ${causes.join("; ")}.`
      : "Nothing the app controls changed, so the provider may not be caching this prompt, or something earlier in it keeps changing (tools, MCP servers or rules).";

  return (
    <NoticeBar
      testId="cache-miss-notice"
      onDismiss={() => dispatch(acknowledgeCacheMisses())}
    >
      <span>
        The prompt cache missed {unseen} times in this session. The last request
        read {formatTokens(readTokens)} of {formatTokens(expectedTokens)}{" "}
        tokens. {why}
      </span>
    </NoticeBar>
  );
}
