import type { Usage } from "core/index.js";
import { minCacheableTokens } from "core/llm/utils/cacheMinimums.js";
import { totalInputTokens } from "core/llm/utils/cacheStats.js";

/**
 * What the session's prompt cache did, counted per request as it happens.
 * Kept apart from the session's token totals on purpose: those add up the
 * provider's own counts, and a Claude request's `promptTokens` leaves out the
 * cache while a GPT request's includes it, so a hit share taken from the sums
 * of a mixed session would be wrong. In memory only; counts, no content.
 */
export interface CacheTally {
  requests: number;
  inputTokens: number;
  readTokens: number;
  writeTokens: number;
  /**
   * Requests that neither read nor wrote the cache and were shorter than the
   * model's minimum cacheable prompt, so the provider could not have cached
   * them whatever the settings. `minimum` is the figure for the latest one.
   */
  belowMinimum: number;
  minimum?: number;
}

const EMPTY: CacheTally = {
  requests: 0,
  inputTokens: 0,
  readTokens: 0,
  writeTokens: 0,
  belowMinimum: 0,
};
let tally: CacheTally = { ...EMPTY };

export function resetCacheTally(): void {
  tally = { ...EMPTY };
}

export function getCacheTally(): Readonly<CacheTally> {
  return { ...tally };
}

/**
 * Add one finished request. `usage.promptTokens` is the provider's own count.
 * `minimumProvider` is the real provider ("bedrock", "anthropic"), which the
 * vendors' minimums depend on; `provider` only decides how the counts add up.
 */
export function recordCacheTally(
  provider: string,
  model: string,
  usage: Usage,
  minimumProvider: string = provider,
): void {
  const total = totalInputTokens(provider, model, usage);
  if (!(total > 0)) return;
  const d = usage.promptTokensDetails;
  const read = d?.cachedTokens ?? 0;
  const write = d?.cacheWriteTokens ?? 0;
  tally.requests += 1;
  tally.inputTokens += total;
  tally.readTokens += read;
  tally.writeTokens += write;
  // A prompt under the minimum is processed uncached and nothing is reported,
  // so the only sign is a short request with no cache traffic.
  const minimum = minCacheableTokens(model, minimumProvider);
  if (minimum !== undefined && total < minimum && read === 0 && write === 0) {
    tally.belowMinimum += 1;
    tally.minimum = minimum;
  }
}

const n = (value: number) => value.toLocaleString("en-US");

/**
 * A session's processed input split into its parts; uncached is never
 * negative. `promptTokens` here is the processed total (src/session.ts).
 */
export function splitInputTokens(usage: {
  promptTokens: number;
  promptTokensDetails?: { cachedTokens?: number; cacheWriteTokens?: number };
}): { uncached: number; cacheRead: number; cacheWrite: number } {
  const cacheRead = usage.promptTokensDetails?.cachedTokens ?? 0;
  const cacheWrite = usage.promptTokensDetails?.cacheWriteTokens ?? 0;
  return {
    uncached: Math.max(0, usage.promptTokens - cacheRead - cacheWrite),
    cacheRead,
    cacheWrite,
  };
}

/** The tally with its summary line, for `cn serve`'s GET /state. */
export interface CacheTallySnapshot extends CacheTally {
  /** The line the TUI prints at exit, or undefined when there is nothing to say. */
  summary?: string;
}

export function cacheTallySnapshot(): CacheTallySnapshot {
  const t = getCacheTally();
  return { ...t, summary: formatCacheTally(t) };
}

/**
 * A line for the end of every turn, whatever happened: formatCacheTally's
 * when the cache was used or something was too short, otherwise a plain
 * statement that nothing was read or written. Undefined before any request.
 */
export function describeCacheTally(
  t: Readonly<CacheTally> = tally,
): string | undefined {
  const line = formatCacheTally(t);
  if (line) return line;
  if (t.requests === 0) return undefined;
  return `Prompt cache: ${n(t.requests)} request${t.requests === 1 ? "" : "s"}, nothing read from or written to the cache`;
}

/**
 * One line for the end of a session, or undefined when there is nothing to
 * report: no request read or wrote the cache and none was too short to be
 * cached (no point suggesting it was used). It does not say whether a miss
 * happened: the CLI does not check for those.
 */
export function formatCacheTally(
  t: Readonly<CacheTally> = tally,
): string | undefined {
  if (t.requests === 0 || t.inputTokens <= 0) return undefined;
  const requests = `${n(t.requests)} request${t.requests === 1 ? "" : "s"}`;
  const used = t.readTokens > 0 || t.writeTokens > 0;
  const tooShort =
    t.belowMinimum > 0 && t.minimum !== undefined
      ? `${n(t.belowMinimum)} of them ${t.belowMinimum === 1 ? "was" : "were"} ` +
        `under the model's ${n(t.minimum)}-token minimum, so could not be cached`
      : undefined;
  if (!used) {
    if (!tooShort) return undefined;
    return t.belowMinimum === t.requests
      ? `Prompt cache: ${requests}, all under the model's ${n(t.minimum!)}-token minimum, so none could be cached`
      : `Prompt cache: ${requests}, ${tooShort}`;
  }
  const share = Math.round((t.readTokens / t.inputTokens) * 100);
  return (
    `Prompt cache: ${requests}, ${share}% of input read from the cache ` +
    `(${n(t.readTokens)} of ${n(t.inputTokens)} tokens), ` +
    `${n(t.writeTokens)} tokens written` +
    (tooShort ? `; ${tooShort}` : "")
  );
}
