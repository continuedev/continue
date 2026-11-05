/**
 * Requests that failed before or while streaming, kept in memory for the
 * session only. They carry no token counts, so they live beside the cache
 * ledger and not in it: the replay and the summary read token counts and would
 * be skewed by empty rows. Kinds and timings only, no message content.
 */

export type RequestFailureKind = "throttled" | "overloaded" | "other";

export interface RequestFailure {
  /** When the failure was seen (ms since epoch). */
  at: number;
  mode?: string;
  provider: string;
  model: string;
  kind: RequestFailureKind;
  /** HTTP status when the message carried one. */
  status?: number;
}

export const FAILURES_MAX = 200;

/**
 * Sorts an error message into the kinds the app treats differently. Matching
 * is on the words providers use: AWS says "ThrottlingException" or "Too many
 * requests", Anthropic and OpenAI answer 429 / "rate limit", Anthropic says
 * "overloaded" (529). A service-quota error is not a throttle (it is an
 * account limit, not a burst), so it stays "other". Returns undefined for a
 * request the user stopped, which is not a failure.
 */
export function classifyRequestFailure(
  message: string | undefined,
  status?: number,
): RequestFailureKind | undefined {
  const text = (message ?? "").toLowerCase();
  if (/\babort(ed)?\b|\bcancel(l)?ed\b/.test(text)) return undefined;
  if (status === 529 || /overloaded|\b529\b/.test(text)) return "overloaded";
  if (
    status === 429 ||
    /throttl|too many requests|rate.?limit|\b429\b/.test(text)
  ) {
    return "throttled";
  }
  return "other";
}

export function appendFailure(
  failures: RequestFailure[] | undefined,
  failure: RequestFailure,
): RequestFailure[] {
  const next = [...(failures ?? []), failure];
  return next.length > FAILURES_MAX ? next.slice(-FAILURES_MAX) : next;
}

export function countFailures(
  failures: RequestFailure[] | undefined,
): Record<RequestFailureKind, number> {
  const counts = { throttled: 0, overloaded: 0, other: 0 };
  for (const f of failures ?? []) counts[f.kind]++;
  return counts;
}
