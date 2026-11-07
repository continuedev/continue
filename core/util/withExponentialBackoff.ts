import {
  DEFAULT_RETRY_POLICY,
  withRetryPolicy,
} from "../llm/utils/retryPolicy.js";

export interface APIError extends Error {
  response?: Response;
}

export const RETRY_AFTER_HEADER = "Retry-After";

/**
 * Retry a call on a rate limit or an overloaded server, by the shared retry
 * policy (llm/utils/retryPolicy.ts): Retry-After in seconds or as a date,
 * jittered exponential waits from `initialDelaySeconds`, capped waits, and
 * an immediate stop when `signal` is aborted. The last failure is thrown,
 * with the number of tries in its message.
 */
const withExponentialBackoff = async <T>(
  apiCall: () => Promise<T>,
  maxTries = 5,
  initialDelaySeconds = 1,
  signal?: AbortSignal,
) =>
  withRetryPolicy(apiCall, {
    policy: {
      ...DEFAULT_RETRY_POLICY,
      maxAttempts: maxTries,
      baseDelayMs: initialDelaySeconds * 1000,
    },
    signal,
    onRetry: ({ attempt, waitMs }) =>
      console.log(
        `Hit rate limit or overload. Retrying in ${(waitMs / 1000).toFixed(1)} seconds (attempt ${attempt + 1})`,
      ),
  });

export { withExponentialBackoff };
