import { BaseLlmApi, isResponsesModel } from "@continuedev/openai-adapters";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.mjs";

import { error, warn } from "../logging.js";

import { formatError } from "./formatError.js";
import { logger } from "./logger.js";

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
 * Checks if the error is a network-related error
 */
function isNetworkError(error: any): boolean {
  const networkCodes = [
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EPIPE",
    "ECONNREFUSED",
  ];
  return networkCodes.includes(error.code);
}

/**
 * Checks if the HTTP status code is retryable
 */
function isRetryableHttpStatus(status: number): boolean {
  // 429 (Too Many Requests), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Checks if the error type indicates a server issue
 */
function isServerError(error: any): boolean {
  return error.type === "server_error" || error.type === "rate_limit_exceeded";
}

/**
 * Checks if the error message indicates a connection issue
 */
function isConnectionError(errorMessage: string): boolean {
  const connectionErrorPatterns = [
    "premature close",
    "premature end",
    "connection reset",
    "socket hang up",
    "aborted",
    "overloaded",
  ];

  return connectionErrorPatterns.some((pattern) =>
    errorMessage.includes(pattern),
  );
}

/**
 * Checks if the error indicates a context length issue (non-retryable)
 */
export function isContextLengthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorMessage = error.message?.toLowerCase() || "";

  if (errorMessage.includes("invalid_request_error")) {
    if (errorMessage.includes("context")) {
      return true;
    }
  }

  const contextLengthPatterns = [
    // Anthropic Claude
    "input length and max_tokens exceed context limit",
    "decrease input length or max_tokens",
    // OpenAI
    "maximum context length",
    "reduce the length of the messages",
    // Mistral
    "tokens in the prompt exceeds",
    "use a shorter prompt",
    // Generic patterns
    "context_length_exceeded",
  ];

  return contextLengthPatterns.some((pattern) =>
    errorMessage.includes(pattern),
  );
}

/**
 * Determines if an error is retryable based on the error type and status code
 */
function isRetryableError(error: any): boolean {
  // Context length errors are never retryable - they need user intervention
  if (isContextLengthError(error)) {
    return false;
  }

  // Network errors are retryable
  if (isNetworkError(error)) {
    return true;
  }

  // HTTP status codes that are retryable
  if (error.status && isRetryableHttpStatus(error.status)) {
    return true;
  }

  // OpenAI/API specific errors
  if (isServerError(error)) {
    return true;
  }

  // Check for connection issues by message content
  const errorMessage = error.message?.toLowerCase();
  if (errorMessage && isConnectionError(errorMessage)) {
    return true;
  }

  return false;
}

/**
 * Calculates the delay for the next retry attempt
 */
function calculateDelay(
  attempt: number,
  options: Required<ExponentialBackoffOptions>,
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
  options: ExponentialBackoffOptions = {},
): Promise<AsyncGenerator<any>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Check if we should abort before making the request
      if (abortSignal.aborted) {
        throw new Error("Request aborted");
      }

      const useResponses =
        typeof llmApi.responsesStream === "function" &&
        isResponsesModel(params.model);

      if (useResponses) {
        return llmApi.responsesStream!(params, abortSignal);
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
        // Log full error details for non-retryable errors
        logger.error("Non-retryable LLM API error", err, {
          status: err.status,
          statusText: err.statusText,
          message: err.message,
          error: err.error,
          model: params.model,
        });
        throw err;
      }

      const delay = calculateDelay(attempt, opts);

      // Only log retry attempts after the first hiddenRetries attempts
      if (attempt >= opts.hiddenRetries) {
        warn(
          `Retrying LLM API call (attempt ${attempt + 1 - opts.hiddenRetries}/${
            opts.maxRetries + 1 - opts.hiddenRetries
          }) after ${delay}ms delay. Error: ${err.message}`,
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
    }`,
  );
  throw lastError;
}

/**
 * Wraps an async generator with exponential backoff retry logic.
 * If the generator throws an error during iteration, it will retry the entire generator.
 */
export async function* withExponentialBackoff<T>(
  generatorFactory: (
    retryAbortSignal: AbortSignal,
  ) => Promise<AsyncGenerator<T>>,
  abortSignal: AbortSignal,
  options: ExponentialBackoffOptions = {},
): AsyncGenerator<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Create a new AbortController for this retry attempt
    // This prevents accumulating listeners on the original signal
    const retryAbortController = new AbortController();

    // Forward abort from the original signal to the retry signal
    const abortListener = () => {
      retryAbortController.abort();
    };

    if (abortSignal.aborted) {
      retryAbortController.abort();
    } else if (typeof abortSignal.addEventListener === "function") {
      abortSignal.addEventListener("abort", abortListener);
    }

    try {
      // Check if we should abort before creating the generator
      if (abortSignal.aborted) {
        throw new Error("Request aborted");
      }

      const generator = await generatorFactory(retryAbortController.signal);

      // Iterate through the generator and yield each value
      for await (const chunk of generator) {
        // Check abort signal during iteration
        if (abortSignal.aborted) {
          throw new Error("Request aborted");
        }

        yield chunk;
      }

      // Clean up the abort listener since we succeeded
      if (typeof abortSignal.removeEventListener === "function") {
        abortSignal.removeEventListener("abort", abortListener);
      }

      // If we successfully completed the generator, we're done
      return;
    } catch (err: any) {
      lastError = err;

      // Clean up the abort listener
      if (typeof abortSignal.removeEventListener === "function") {
        abortSignal.removeEventListener("abort", abortListener);
      }

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
      logger.debug("Retry attempt", { attempt, delay, error: err.message });

      // Only log retry attempts after the first opts.hiddenRetries attempts
      if (attempt >= opts.hiddenRetries) {
        warn(
          `Retrying request (${attempt + 1 - opts.hiddenRetries}/${
            opts.maxRetries + 1 - opts.hiddenRetries
          }). Error: ${formatError(err)}`,
        );
      }

      // Wait before retrying
      logger.debug("Waiting before retry", { delayMs: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  error(
    `Failed after ${opts.maxRetries + 1} attempts. Last error: ${
      lastError.message
    }`,
  );
  throw lastError;
}
