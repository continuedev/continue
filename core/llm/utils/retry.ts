/**
 * Configuration options for the retry decorator
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Jitter factor between 0 and 1 (default: 0.3) */
  jitterFactor?: number;
  /** Custom function to determine if an error should be retried */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Custom function called on each retry attempt */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

/**
 * Default configuration for retry behavior
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.3,
  shouldRetry: defaultShouldRetry,
  onRetry: defaultOnRetry,
};

/**
 * Default function to determine if an error should be retried
 * Retries on:
 * - Network errors
 * - HTTP 429 (Too Many Requests)
 * - HTTP 5xx (Server errors)
 * - Specific AWS errors
 * - Timeout errors
 */
function defaultShouldRetry(error: any, attempt: number): boolean {
  // Note: maxAttempts check is handled by the retry logic itself
  // This function only determines if the error type is retryable

  // Network/connection errors
  if (
    error.code === "ENOTFOUND" ||
    error.code === "ECONNRESET" ||
    error.code === "ECONNREFUSED" ||
    error.code === "ETIMEDOUT"
  ) {
    return true;
  }

  // AWS SDK specific errors (v3 - check for AWS error structure and retryable types)
  const isAwsError =
    error.$fault || error.$metadata || (error.name && error.__type);
  const awsRetryableErrors = [
    "ThrottlingException",
    "ServiceUnavailableException",
    "InternalServerError",
    "RequestTimeout",
    "ModelNotReadyException",
    "ModelTimeoutException",
    "ResourceNotFoundException",
  ];

  if (isAwsError && error.name && awsRetryableErrors.includes(error.name)) {
    return true;
  }

  // HTTP status codes
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;

    // Rate limiting
    if (status === 429) {
      return true;
    }

    // Server errors (5xx)
    if (status >= 500 && status < 600) {
      return true;
    }

    // Don't retry client errors (4xx except 429)
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Timeout errors
  if (
    error.name === "TimeoutError" ||
    error.message?.includes("timeout") ||
    error.message?.includes("TIMEOUT")
  ) {
    return true;
  }

  // Abort signal errors should not be retried
  if (error.name === "AbortError" || error.code === "ABORT_ERR") {
    return false;
  }

  // Default to not retrying unknown errors
  return false;
}

/**
 * Default function called on each retry attempt
 */
function defaultOnRetry(error: any, attempt: number, delay: number): void {
  console.warn(
    `Retry attempt ${attempt} after ${delay}ms delay. Error: ${error.message || error}`,
  );
}

/**
 * Calculate delay with rate limit header awareness and exponential backoff fallback
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number,
  error?: any,
): number {
  // Check for rate limiting headers first (more accurate than exponential backoff)
  if (error?.headers) {
    const retryAfter =
      error.headers["retry-after"] ||
      error.headers["x-ratelimit-reset"] ||
      error.headers["ratelimit-reset"] ||
      error.headers["Retry-After"] ||
      error.headers["X-RateLimit-Reset"] ||
      error.headers["RateLimit-Reset"];

    if (retryAfter) {
      let delayMs: number;

      // Parse retry-after header (can be seconds or HTTP date)
      if (typeof retryAfter === "string" && isNaN(Number(retryAfter))) {
        // HTTP date format
        const resetTime = new Date(retryAfter).getTime();
        const now = Date.now();
        delayMs = Math.max(0, resetTime - now);
      } else {
        // Seconds format
        delayMs = Number(retryAfter) * 1000;
      }

      // Apply small jitter to spread requests, then respect maxDelay as hard limit
      const jitterMultiplier = 1 + (Math.random() * 0.1 - 0.05); // Small jitter ±5%
      const jitteredDelay = delayMs * jitterMultiplier;
      return Math.max(0, Math.floor(Math.min(jitteredDelay, maxDelay)));
    }
  }

  // Fallback to exponential backoff if no rate limit headers
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter: random value between (1 - jitterFactor) and (1 + jitterFactor)
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * jitterFactor;
  const jitteredDelay = cappedDelay * jitterMultiplier;

  return Math.max(0, Math.floor(jitteredDelay));
}

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator for async functions with exponential backoff and jitter
 *
 * @param options Retry configuration options
 * @returns Decorator function
 *
 * @example
 * ```typescript
 * class MyLLM {
 *   @withRetry({ maxAttempts: 5, baseDelay: 2000 })
 *   async streamChat(messages: ChatMessage[]): Promise<AsyncGenerator<ChatMessage>> {
 *     // Implementation that might fail
 *   }
 * }
 * ```
 */
export function withRetry(options: RetryOptions = {}) {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return function (...args: any[]): any {
    // Handle different decorator calling patterns
    const [target, propertyName, descriptor] = args;

    // Get the original method
    let originalMethod: Function;
    if (descriptor && descriptor.value) {
      originalMethod = descriptor.value;
    } else {
      // Get method from prototype
      originalMethod = target[propertyName];
    }

    if (!originalMethod || typeof originalMethod !== "function") {
      throw new Error(`@withRetry can only be applied to methods`);
    }

    // Check if the original method is an async generator function
    const isAsyncGenerator =
      originalMethod.constructor.name === "AsyncGeneratorFunction";

    const wrappedMethod = isAsyncGenerator
      ? async function* (this: any, ...methodArgs: any[]) {
          let lastError: any;

          for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
              const generator = originalMethod.apply(this, methodArgs);
              yield* createRetryableAsyncGenerator(
                generator,
                config,
                originalMethod,
                this,
                methodArgs,
                attempt,
              );
              return; // Successfully completed
            } catch (error) {
              lastError = error;

              // Check if we should retry this error
              if (!config.shouldRetry(error, attempt)) {
                throw error;
              }

              // Don't delay on the last attempt
              if (attempt === config.maxAttempts) {
                break;
              }

              // Calculate delay and wait
              const delay = calculateDelay(
                attempt,
                config.baseDelay,
                config.maxDelay,
                config.jitterFactor,
                error,
              );

              config.onRetry(error, attempt, delay);
              await sleep(delay);
            }
          }

          // If we get here, all attempts failed
          throw lastError;
        }
      : async function (this: any, ...methodArgs: any[]) {
          let lastError: any;

          for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
            try {
              const result = originalMethod.apply(this, methodArgs);
              return await result;
            } catch (error) {
              lastError = error;

              // Check if we should retry this error
              if (!config.shouldRetry(error, attempt)) {
                throw error;
              }

              // Don't delay on the last attempt
              if (attempt === config.maxAttempts) {
                break;
              }

              // Calculate delay and wait
              const delay = calculateDelay(
                attempt,
                config.baseDelay,
                config.maxDelay,
                config.jitterFactor,
                error,
              );

              config.onRetry(error, attempt, delay);

              await sleep(delay);
            }
          }

          // If we get here, all attempts failed
          throw lastError;
        };

    // Apply the wrapped method based on how the decorator was called
    if (descriptor) {
      descriptor.value = wrappedMethod;
      return descriptor;
    } else {
      // Handle case where descriptor is not provided
      target[propertyName] = wrappedMethod;
      return wrappedMethod;
    }
  };
}

/**
 * Creates a retryable async generator that handles errors during iteration
 */
async function* createRetryableAsyncGenerator<T>(
  generator: AsyncGenerator<T>,
  config: Required<RetryOptions>,
  originalMethod: Function,
  context: any,
  args: any[],
  initialAttempt: number,
): AsyncGenerator<T> {
  let currentGenerator = generator;
  let attempt = initialAttempt;

  try {
    for await (const value of currentGenerator) {
      yield value;
    }
  } catch (error) {
    // If we encounter an error during iteration, we can retry by creating a new generator
    let lastError = error;

    for (
      let retryAttempt = attempt + 1;
      retryAttempt <= config.maxAttempts;
      retryAttempt++
    ) {
      // Check if we should retry this error
      if (!config.shouldRetry(error, retryAttempt)) {
        throw error;
      }

      // Don't delay on the last attempt
      if (retryAttempt === config.maxAttempts) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        retryAttempt,
        config.baseDelay,
        config.maxDelay,
        config.jitterFactor,
        error,
      );

      config.onRetry(error, retryAttempt, delay);
      await sleep(delay);

      try {
        // Create a new generator and continue iteration
        const newGenerator = await originalMethod.apply(context, args);

        if (
          newGenerator &&
          typeof newGenerator[Symbol.asyncIterator] === "function"
        ) {
          for await (const value of newGenerator) {
            yield value;
          }
          return; // Successfully completed
        } else {
          throw new Error("Method did not return an async generator on retry");
        }
      } catch (retryError) {
        lastError = retryError;
        error = retryError;
      }
    }

    // If we get here, all retry attempts failed
    throw lastError;
  }
}

/**
 * Functional version of retry for use without decorators
 *
 * @param fn Function to retry
 * @param options Retry configuration options
 * @returns Promise that resolves with the function result or rejects with the last error
 *
 * @example
 * ```typescript
 * const result = await retryAsync(
 *   () => someApiCall(),
 *   { maxAttempts: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!config.shouldRetry(error, attempt)) {
        throw error;
      }

      // Don't delay on the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateDelay(
        attempt,
        config.baseDelay,
        config.maxDelay,
        config.jitterFactor,
        error,
      );

      config.onRetry(error, attempt, delay);

      await sleep(delay);
    }
  }

  // If we get here, all attempts failed
  throw lastError;
}

/**
 * Retry decorator specifically configured for LLM providers
 * Uses sensible defaults for LLM API calls, including longer delays
 * for capacity provisioning (e.g., AWS Bedrock can require up to 59+ seconds)
 */
export function withLLMRetry(options: Partial<RetryOptions> = {}) {
  return withRetry({
    maxAttempts: 5, // More attempts for capacity issues
    baseDelay: 2000, // Start with 2 seconds
    maxDelay: 90000, // Allow up to 90 seconds for capacity provisioning
    jitterFactor: 0.4, // Slightly more jitter to spread load
    ...options,
  });
}
