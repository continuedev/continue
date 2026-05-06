export interface APIError extends Error {
  status?: number;
  response?: Response;
  code?: string;
}

export const RETRY_AFTER_HEADER = "Retry-After";

export interface ExponentialBackoffOptions {
  maxDelaySeconds?: number;
  backoffMultiplier?: number;
  jitterFactor?: number;
  retryableStatuses?: number[];
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (details: {
    attempt: number;
    maxTries: number;
    delaySeconds: number;
    error: unknown;
  }) => void;
}

const DEFAULT_RETRYABLE_STATUSES = [
  408, 409, 425, 429, 500, 502, 503, 504, 529,
];
const DEFAULT_NETWORK_CODES = [
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EPIPE",
  "ECONNREFUSED",
];

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;

  const directStatus = (error as APIError).status;
  if (typeof directStatus === "number") return directStatus;

  const responseStatus = (error as APIError).response?.status;
  if (typeof responseStatus === "number") return responseStatus;

  return undefined;
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const raw = (error as APIError).response?.headers.get(RETRY_AFTER_HEADER);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasContextLengthError(message: string): boolean {
  return (
    message.includes("context length") ||
    message.includes("context_length_exceeded") ||
    message.includes("input length and max_tokens exceed context limit")
  );
}

function isRetryableError(
  error: unknown,
  options: ExponentialBackoffOptions,
): boolean {
  if (options.shouldRetry) {
    return options.shouldRetry(error);
  }

  const status = getErrorStatus(error);
  if (
    status !== undefined &&
    (options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES).includes(status)
  ) {
    return true;
  }

  if (!error || typeof error !== "object") return false;
  const err = error as APIError;
  const lowerMessage = (err.message ?? "").toLowerCase();

  if (hasContextLengthError(lowerMessage)) return false;
  if (
    /"code"\s*:\s*429/.test(err.message ?? "") ||
    lowerMessage.includes("overloaded") ||
    lowerMessage.includes("malformed json") ||
    lowerMessage.includes("premature close") ||
    lowerMessage.includes("socket hang up")
  ) {
    return true;
  }

  return DEFAULT_NETWORK_CODES.includes(err.code ?? "");
}

function calculateDelaySeconds(
  attempt: number,
  initialDelaySeconds: number,
  options: ExponentialBackoffOptions,
  retryAfterSeconds?: number,
): number {
  if (retryAfterSeconds !== undefined) {
    return retryAfterSeconds;
  }

  const multiplier = options.backoffMultiplier ?? 2;
  const maxDelay = options.maxDelaySeconds ?? 32;
  const baseDelay = Math.min(
    initialDelaySeconds * multiplier ** attempt,
    maxDelay,
  );

  const jitterFactor = options.jitterFactor ?? 0.25;
  const jitterAmount = Math.random() * jitterFactor * baseDelay;
  return baseDelay + jitterAmount;
}

const withExponentialBackoff = async <T>(
  apiCall: () => Promise<T>,
  maxTries = 5,
  initialDelaySeconds = 1,
  options: ExponentialBackoffOptions = {},
) => {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error: unknown) {
      if (!isRetryableError(error, options)) {
        throw error;
      }

      if (attempt === maxTries - 1) {
        break;
      }

      const delaySeconds = calculateDelaySeconds(
        attempt,
        initialDelaySeconds,
        options,
        getRetryAfterSeconds(error),
      );

      options.onRetry?.({
        attempt: attempt + 1,
        maxTries,
        delaySeconds,
        error,
      });

      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  }
  throw new Error("Failed to make API call after max tries");
};

export { withExponentialBackoff };
