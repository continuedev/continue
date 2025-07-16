import { BaseLlmApi } from "@continuedev/openai-adapters";
import { warn, error } from "../logging.js";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources.mjs";

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
}

const DEFAULT_OPTIONS: Required<ExponentialBackoffOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Determines if an error is retryable based on the error type and status code
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  // HTTP status codes that are retryable
  if (error.status) {
    const status = error.status;
    // 429 (Too Many Requests), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  
  // OpenAI specific errors
  if (error.type === 'server_error' || error.type === 'rate_limit_exceeded') {
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
  const baseDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
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
        throw new Error('Request aborted');
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
      
      warn(
        `Retrying LLM API call (attempt ${attempt + 1}/${opts.maxRetries + 1}) after ${delay}ms delay. Error: ${err.message}`
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all retries failed
  error(`LLM API call failed after ${opts.maxRetries + 1} attempts. Last error: ${lastError.message}`);
  throw lastError;
}