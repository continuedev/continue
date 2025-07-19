import { BaseLlmApi } from "@continuedev/openai-adapters";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.mjs";
import { error, warn } from "../logging.js";
import { formatError } from "./formatError.js";
import logger from "./logger.js";

export interface ExponentialBackoffOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Jitter factor to add randomness */
  jitter?: boolean;
  /** Number of retries to hide from logging */
  hiddenRetries?: number;
}

const DEFAULT_OPTIONS: Required<ExponentialBackoffOptions> = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 1.6,
  jitter: true,
  hiddenRetries: 2,
};

/**
 * Determines if an error is retryable based on the error type and status code
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (
    error.code === "ECONNRESET" ||
    error.code === "ENOTFOUND" ||
    error.code === "ETIMEDOUT"
  ) {
    return true;
  }

  // HTTP status codes that are retryable
  if (error.status) {
    const status = error.status;
    // 429 (Too Many Requests), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  // OpenAI specific errors
  if (error.type === "server_error" || error.type === "rate_limit_exceeded") {
    return true;
  }

  // Anthropic specific errors
  const lower = error.message?.toLowerCase();
  if (lower?.includes("overloaded")) {
    return true;
  }

  return false;
}

/**
 * Calculates the delay for the next retry attempt
 */
function calculateDelay(
  attempt: number,
  options: Required<ExponentialBackoffOptions>
): number {
  const baseDelay =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, options.maxDelay);

  if (options.jitter) {
    // Add jitter: randomize between 50% and 100% of the calculated delay
    return Math.floor(cappedDelay * (0.5 + Math.random() * 0.5));
  }

  return cappedDelay;
}

/**
 * Wrapper around llmApi.chatCompletionStream with exponential backoff retry logic
 */
export async function chatCompletionStreamWithBackoff(
  llmApi: BaseLlmApi,
  params: ChatCompletionCreateParamsStreaming,
  abortSignal: AbortSignal,
  options: ExponentialBackoffOptions = {}
): Promise<AsyncGenerator<any>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if we should abort before making the request
      if (abortSignal.aborted) {
        throw new Error("Request aborted");
      }

      return llmApi.chatCompletionStream(params, abortSignal);
    } catch (err: any) {
      lastError = err;

      // Don't retry if the request was aborted
      if (abortSignal.aborted) {
        throw err;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Only retry if the error is retryable
      if (!isRetryableError(err)) {
        throw err;
      }

      const delay = calculateDelay(attempt, opts);

      // Only log retry attempts after the first hiddenRetries attempts
      if (attempt >= opts.hiddenRetries) {
        warn(
          `Retrying LLM API call (attempt ${attempt + 1 - opts.hiddenRetries}/${
            opts.maxRetries + 1 - opts.hiddenRetries
          }) after ${delay}ms delay. Error: ${err.message}`
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  error(
    `LLM API call failed after ${opts.maxRetries + 1} attempts. Last error: ${
      lastError.message
    }`
  );
  throw lastError;
}

/**
 * Wraps an async generator with exponential backoff retry logic.
 * If the generator throws an error during iteration, it will retry the entire generator.
 */
export async function* withExponentialBackoff<T>(
  generatorFactory: () => Promise<AsyncGenerator<T>>,
  abortSignal: AbortSignal,
  options: ExponentialBackoffOptions = {}
): AsyncGenerator<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    let yieldedValues: T[] = [];

    try {
      // Check if we should abort before creating the generator
      if (abortSignal.aborted) {
        throw new Error("Request aborted");
      }

      const generator = await generatorFactory();

      // Iterate through the generator and yield each value
      for await (const chunk of generator) {
        // Check abort signal during iteration
        if (abortSignal.aborted) {
          throw new Error("Request aborted");
        }

        yieldedValues.push(chunk);
        yield chunk;
      }

      // If we successfully completed the generator, we're done
      return;
    } catch (err: any) {
      lastError = err;

      // Don't retry if the request was aborted
      if (abortSignal.aborted) {
        throw err;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Only retry if the error is retryable
      if (!isRetryableError(err)) {
        throw err;
      }

      const delay = calculateDelay(attempt, opts);
      logger.debug('Retry attempt', { attempt, delay, error: err.message });

      // Only log retry attempts after the first opts.hiddenRetries attempts
      if (attempt >= opts.hiddenRetries) {
        warn(
          `Retrying request (${attempt + 1 - opts.hiddenRetries}/${
            opts.maxRetries + 1 - opts.hiddenRetries
          }). Error: ${formatError(err)}`
        );
      }

      // Wait before retrying
      logger.debug('Waiting before retry', { delayMs: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  error(
    `Failed after ${opts.maxRetries + 1} attempts. Last error: ${
      lastError.message
    }`
  );
  throw lastError;
}
