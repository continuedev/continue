/**
 * Preserve the native fetch implementation before any modules can pollute it.
 * This is critical for @google/genai which requires native fetch behavior.
 *
 * The Vercel AI SDK packages (ai, @ai-sdk/openai, @ai-sdk/anthropic) can
 * pollute the global fetch/Response objects, breaking stream handling in
 * @google/genai (causing "getReader is not a function" errors).
 *
 * This module MUST be imported before any other modules that might modify fetch.
 */

// Store references to native fetch and related globals at module load time
export const nativeFetch = globalThis.fetch;
export const nativeResponse = globalThis.Response;
export const nativeRequest = globalThis.Request;
export const nativeHeaders = globalThis.Headers;

/**
 * Temporarily restores native fetch for the duration of a callback.
 * Use this when you need to ensure native fetch behavior for specific operations.
 *
 * This wrapper:
 * 1. Saves the current (possibly polluted) fetch globals
 * 2. Restores the native implementations
 * 3. Executes the callback
 * 4. Restores the previous (possibly polluted) implementations
 *
 * This ensures GoogleGenAI gets native fetch while other packages
 * (like Vercel SDK) can still use their modified fetch implementations.
 */
export function withNativeFetch<T>(callback: () => T): T {
  const originalFetch = globalThis.fetch;
  const originalResponse = globalThis.Response;
  const originalRequest = globalThis.Request;
  const originalHeaders = globalThis.Headers;

  try {
    // Restore native implementations
    globalThis.fetch = nativeFetch;
    globalThis.Response = nativeResponse;
    globalThis.Request = nativeRequest;
    globalThis.Headers = nativeHeaders;

    return callback();
  } finally {
    // Restore whatever was there before (possibly polluted versions)
    globalThis.fetch = originalFetch;
    globalThis.Response = originalResponse;
    globalThis.Request = originalRequest;
    globalThis.Headers = originalHeaders;
  }
}
