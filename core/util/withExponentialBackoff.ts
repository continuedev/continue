export interface APIError extends Error {
  response?: Response;
}

export const RETRY_AFTER_HEADER = "Retry-After";

/**
 * Check if an error is a transient network error that should be retried.
 * These are typically TypeError: fetch failed from Node.js undici,
 * caused by timeouts, connection resets, or DNS failures.
 */
export function isTransientFetchError(error: any): boolean {
  if (error?.name === "TypeError" && error?.message === "fetch failed") {
    return true;
  }
  const code = error?.cause?.code ?? error?.code;
  if (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT"
  ) {
    return true;
  }
  return false;
}

const withExponentialBackoff = async <T>(
  apiCall: () => Promise<T>,
  maxTries = 5,
  initialDelaySeconds = 1,
) => {
  for (let attempt = 0; attempt < maxTries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error: any) {
      const lowerMessage = (error.message ?? "").toLowerCase();
      const isRateLimit =
        (error as APIError).response?.status === 429 ||
        /"code"\s*:\s*429/.test(error.message ?? "") ||
        lowerMessage.includes("overloaded") ||
        lowerMessage.includes("malformed json");
      const isTransient = isTransientFetchError(error);

      if (isRateLimit || isTransient) {
        const retryAfter = (error as APIError).response?.headers.get(
          RETRY_AFTER_HEADER,
        );
        const delay = retryAfter
          ? parseInt(retryAfter, 10)
          : initialDelaySeconds * 2 ** attempt;
        const reason = isTransient ? "network error" : "rate limit";
        console.log(
          `Hit ${reason}. Retrying in ${delay} seconds (attempt ${
            attempt + 1
          })`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      } else {
        throw error; // Re-throw other errors
      }
    }
  }
  throw new Error(`Failed to make API call after ${maxTries} retries`);
};

export { withExponentialBackoff };
