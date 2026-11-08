/**
 * One policy for waiting before a request is tried again: which failures
 * are worth retrying, how long to wait, and when to stop.
 *
 * - A rate limit (429, RFC 6585 §4) or an unavailable or overloaded server
 *   (503, RFC 9110 §15.6.4; 529, Anthropic's "overloaded") is retried.
 * - The server's Retry-After wins when it sends one, in either form RFC 9110
 *   §10.2.3 allows: a number of seconds or an HTTP-date.
 * - Otherwise the wait doubles from `baseDelayMs`, with full jitter so that
 *   several agents hitting one limit do not retry in step.
 * - No single wait exceeds `maxDelayMs`, and the waits together stay within
 *   `maxTotalWaitMs`: a server asking for longer is reported at once, with
 *   how long it asked for, instead of the request hanging.
 *
 * A model route with another route after it does not use this at all: the
 * next account is tried instead (BaseLLM.failOverQuickly).
 */

export interface RetryPolicy {
  /** Tries in all, the first included. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxTotalWaitMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  maxTotalWaitMs: 90_000,
};

const RETRY_STATUSES = new Set([429, 503, 529]);

/**
 * Retry-After as a wait in milliseconds, or undefined when absent or not
 * valid. Seconds may carry a fraction (some servers send one, though the
 * RFC's delay-seconds is an integer); a date in the past means no wait.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 1000);
  }
  // An HTTP-date names its day and month; Date.parse alone would take "-5"
  if (!/[a-z]{3}/i.test(trimmed)) return undefined;
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

interface ResponseLike {
  status?: number;
  headers?: { get(name: string): string | null } | Record<string, unknown>;
}

function headerOf(response: ResponseLike | undefined, name: string) {
  const headers = response?.headers as
    | { get?: (name: string) => string | null }
    | Record<string, unknown>
    | undefined;
  if (!headers) return undefined;
  if (typeof headers.get === "function") {
    return (headers.get as (name: string) => string | null)(name) ?? undefined;
  }
  const found = Object.entries(headers).find(
    ([k]) => k.toLowerCase() === name.toLowerCase(),
  );
  return typeof found?.[1] === "string" ? found[1] : undefined;
}

/**
 * Whether a failure is worth retrying on the same account, and the wait the
 * server asked for. Reads the status and headers of an error carrying a
 * Response (`response`), an SDK error (`status`, `headers`) and an AWS SDK
 * error (`$metadata.httpStatusCode`), and the wording of providers that send
 * the condition inside a 200 stream.
 */
export function retryableFailure(
  error: unknown,
  now: number = Date.now(),
): { retry: boolean; retryAfterMs?: number } {
  const e = error as {
    message?: string;
    name?: string;
    status?: number;
    headers?: ResponseLike["headers"];
    response?: ResponseLike;
    $metadata?: { httpStatusCode?: number };
  };
  if (!e || typeof e !== "object") return { retry: false };
  const status =
    e.response?.status ?? e.status ?? e.$metadata?.httpStatusCode ?? undefined;
  const message = (e.message ?? "").toLowerCase();
  const retry =
    (status !== undefined && RETRY_STATUSES.has(status)) ||
    /"code"\s*:\s*429/.test(e.message ?? "") ||
    message.includes("overloaded") ||
    message.includes("malformed json") ||
    /throttlingexception|too many requests|rate limit/i.test(
      `${e.name ?? ""} ${e.message ?? ""}`,
    );
  if (!retry) return { retry: false };
  const header =
    headerOf(e.response, "retry-after") ??
    headerOf({ headers: e.headers }, "retry-after");
  const retryAfterMs = parseRetryAfter(header, now);
  return retryAfterMs === undefined ? { retry } : { retry, retryAfterMs };
}

/**
 * The wait before try number `attempt + 1` (attempt counts from 0): the
 * server's Retry-After when given, else a random wait up to
 * `baseDelayMs * 2^attempt` (full jitter), never more than `maxDelayMs`.
 */
export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  retryAfterMs?: number,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) return retryAfterMs;
  const ceiling = Math.min(
    policy.maxDelayMs,
    policy.baseDelayMs * 2 ** attempt,
  );
  return Math.round(random() * ceiling);
}

/** Thrown when the server asks to wait longer than the policy allows. */
export class RetryWaitTooLongError extends Error {
  constructor(
    readonly waitMs: number,
    cause: unknown,
  ) {
    super(
      `The server asked to wait ${Math.ceil(waitMs / 1000)} s before trying again (rate limit or overload), longer than Continuous waits on its own. Try again later, or pick another model. (${(cause as Error)?.message ?? cause})`,
      { cause },
    );
    this.name = "RetryWaitTooLongError";
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Call `fn`, retrying retryable failures by the policy. A cancelled request
 * stops at once. When the tries run out, the last failure is thrown, with
 * the count in its message.
 */
export async function withRetryPolicy<T>(
  fn: () => Promise<T>,
  options: {
    policy?: RetryPolicy;
    signal?: AbortSignal;
    onRetry?: (info: {
      attempt: number;
      waitMs: number;
      error: unknown;
    }) => void;
  } = {},
): Promise<T> {
  const policy = options.policy ?? DEFAULT_RETRY_POLICY;
  let waited = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw error;
      const { retry, retryAfterMs } = retryableFailure(error);
      if (!retry) throw error;
      if (attempt === policy.maxAttempts - 1) break;
      const waitMs = retryDelayMs(attempt, policy, retryAfterMs);
      if (
        retryAfterMs !== undefined &&
        (retryAfterMs > policy.maxDelayMs ||
          waited + retryAfterMs > policy.maxTotalWaitMs)
      ) {
        throw new RetryWaitTooLongError(retryAfterMs, error);
      }
      if (waited + waitMs > policy.maxTotalWaitMs) break;
      options.onRetry?.({ attempt, waitMs, error });
      await sleep(waitMs, options.signal);
      waited += waitMs;
      if (options.signal?.aborted) throw error;
    }
  }
  const message = (lastError as Error)?.message ?? String(lastError);
  throw new Error(
    `Failed to make API call after ${policy.maxAttempts} retries: ${message}`,
    { cause: lastError },
  );
}
