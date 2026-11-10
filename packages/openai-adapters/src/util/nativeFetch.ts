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

function isConstructableHeaders(
  headers: unknown,
): headers is typeof globalThis.Headers {
  if (typeof headers !== "function") {
    return false;
  }
  try {
    new (headers as new () => object)();
    return true;
  } catch {
    return false;
  }
}

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Promise<unknown>).then === "function"
  );
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
      "function"
  );
}

/**
 * Hold native fetch globals until `iterable` completes, throws, or is closed.
 * `finally` runs once for normal completion, a thrown `next()`, and `break`.
 */
function preserveNativeForIteration(
  iterable: AsyncIterable<unknown>,
  restoreOnce: () => void,
): AsyncIterable<unknown> {
  async function* iterated(): AsyncGenerator<unknown> {
    try {
      yield* iterable;
    } finally {
      restoreOnce();
    }
  }
  return iterated();
}

/**
 * Temporarily restores native fetch for the duration of a callback.
 * Use this when you need to ensure native fetch behavior for specific operations.
 *
 * This wrapper:
 * 1. Saves the current (possibly polluted) fetch globals
 * 2. Restores the native implementations
 * 3. Executes the callback
 * 4. For a sync return value (such as `new GoogleGenAI(...)`), restores the
 *    previous globals before returning. A returned Promise or async iterable
 *    — the `generateContentStream` shape — keeps them installed until that
 *    iterable completes, throws, or is broken, then restores them once.
 *    Restoring in a synchronous `finally` runs before response handling, and
 *    a later `new Headers()` throws "Headers is not a constructor".
 *
 * The snapshotted Headers is installed only when it is constructable
 * (`typeof` function and `new Headers()` succeeds). Otherwise the current
 * global is left in place.
 *
 * This ensures GoogleGenAI gets native fetch while other packages
 * (like Vercel SDK) can still use their modified fetch implementations.
 */
export function withNativeFetch<T>(callback: () => T): T {
  const originalFetch = globalThis.fetch;
  const originalResponse = globalThis.Response;
  const originalRequest = globalThis.Request;
  const originalHeaders = globalThis.Headers;

  globalThis.fetch = nativeFetch;
  globalThis.Response = nativeResponse;
  globalThis.Request = nativeRequest;
  if (isConstructableHeaders(nativeHeaders)) {
    globalThis.Headers = nativeHeaders;
  }

  let restored = false;
  const restoreOnce = () => {
    if (restored) {
      return;
    }
    restored = true;
    globalThis.fetch = originalFetch;
    globalThis.Response = originalResponse;
    globalThis.Request = originalRequest;
    globalThis.Headers = originalHeaders;
  };

  try {
    const result = callback();

    if (isPromise(result)) {
      return result.then(
        (value: unknown) => {
          if (isAsyncIterable(value)) {
            return preserveNativeForIteration(value, restoreOnce);
          }
          restoreOnce();
          return value;
        },
        (error: unknown) => {
          restoreOnce();
          throw error;
        },
      ) as T;
    }

    if (isAsyncIterable(result)) {
      return preserveNativeForIteration(result, restoreOnce) as T;
    }

    restoreOnce();
    return result;
  } catch (error) {
    restoreOnce();
    throw error;
  }
}
