import { RequestOptions } from "@continuedev/config-types";
import { Readable } from "node:stream";

import { customFetch } from "../util.js";
import {
  nativeHeaders,
  nativeRequest,
  nativeResponse,
  withNativeFetch,
} from "./nativeFetch.js";

/** Statuses the WHATWG Response constructor rejects a non-null body for. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

/**
 * True when requestOptions carry settings only customFetch can honor —
 * proxying and TLS configuration. Headers and timeout are excluded on
 * purpose: those already reach the @google/genai SDK via httpOptions.
 */
export function hasProxyOrTlsOptions(
  requestOptions: RequestOptions | undefined,
): boolean {
  return (
    !!requestOptions &&
    (requestOptions.proxy !== undefined ||
      requestOptions.verifySsl !== undefined ||
      requestOptions.caBundlePath !== undefined ||
      requestOptions.clientCertificate !== undefined)
  );
}

/**
 * True when an ambient HTTPS_PROXY/HTTP_PROXY environment proxy exists.
 * Env-var proxies are the standard corporate setup and are honored by every
 * customFetch-based provider; the Gemini SDK path must match. Resolution
 * precedence (config over env) and NO_PROXY bypass stay entirely with
 * customFetch/getProxy at request time — this predicate only decides whether
 * to engage the wrapper, so it reads the same four variables
 * @continuedev/fetch's getProxyFromEnv reads (that helper is not part of the
 * package's public API).
 */
function hasEnvironmentProxy(): boolean {
  const { HTTPS_PROXY, https_proxy, HTTP_PROXY, http_proxy } = process.env;
  return !!(HTTPS_PROXY || https_proxy || HTTP_PROXY || http_proxy);
}

/**
 * Convert a node-fetch Response (Node Readable body, no getReader) into a
 * native WHATWG Response the @google/genai SDK can stream from. Without this
 * adaptation the SDK fails with "getReader is not a function" — the exact
 * pollution problem documented in nativeFetch.ts.
 */
export function adaptToNativeResponse(response: {
  status: number;
  statusText: string;
  headers: Iterable<[string, string]>;
  body: Readable | ReadableStream<Uint8Array> | null;
}): Response {
  const headers = new nativeHeaders([...response.headers]);

  let body: BodyInit | null = null;
  if (response.body !== null && !NULL_BODY_STATUSES.has(response.status)) {
    body =
      response.body instanceof Readable
        ? // Node's stream/web ReadableStream and the DOM lib type describe the
          // same runtime object; the cast bridges the two type declarations.
          (Readable.toWeb(response.body) as ReadableStream)
        : response.body;
  }

  return new nativeResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Serializes the global-fetch swap window across concurrent callers.
 *
 * The swapped `globalThis.fetch` is bound by closure to ONE config's
 * requestOptions (its proxy Agent, client certificate, and headers). Without
 * serialization, two concurrent Gemini calls with different configs race on
 * the shared global — config A's gateway credential / mTLS identity could
 * ride config B's request (chat behind a corporate gateway + concurrent
 * embedding indexing is a normal Continue pattern). This mutex admits one
 * swap window at a time.
 *
 * Only the swap window (call establishment) is held: `body` resolves once the
 * SDK's stream is established, before body iteration, so streams still run
 * concurrently after the lock is released. The tail promise is always
 * released in `finally`, including when `body` throws.
 */
let fetchSwapChain: Promise<void> = Promise.resolve();

async function withSerializedFetchSwap<T>(body: () => Promise<T>): Promise<T> {
  const prior = fetchSwapChain;
  let release!: () => void;
  fetchSwapChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await body();
  } finally {
    release();
  }
}

/**
 * Run `fn` with globalThis.fetch honoring the given requestOptions.
 *
 * - No proxy/TLS options: delegates to withNativeFetch — byte-identical to
 *   the previous behavior for every existing config, and unlocked (the native
 *   fast path installs no config-bound credentials, so it needs no
 *   serialization).
 * - Proxy/TLS options present: swaps globalThis.fetch for the duration of
 *   `fn` with a fetch that routes through customFetch(requestOptions)
 *   (proxy, CA bundles, client certs, verifySsl) and adapts its node-fetch
 *   Response to a native one so SDK streaming keeps working. The swap window
 *   is serialized (see withSerializedFetchSwap) so concurrent configs cannot
 *   leak credentials across each other. The previous globals are restored in
 *   a finally, including when `fn` throws.
 */
export async function withRequestOptionsFetch<T>(
  requestOptions: RequestOptions | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!hasProxyOrTlsOptions(requestOptions) && !hasEnvironmentProxy()) {
    return withNativeFetch(fn);
  }

  const optionsFetch = customFetch(requestOptions);
  const wrappedFetch: typeof globalThis.fetch = async (input, init) => {
    const response = await optionsFetch(input, init);
    return adaptToNativeResponse(response);
  };

  return withSerializedFetchSwap(async () => {
    const originalFetch = globalThis.fetch;
    const originalResponse = globalThis.Response;
    const originalRequest = globalThis.Request;
    const originalHeaders = globalThis.Headers;

    try {
      globalThis.fetch = wrappedFetch;
      globalThis.Response = nativeResponse;
      globalThis.Request = nativeRequest;
      globalThis.Headers = nativeHeaders;

      return await fn();
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.Response = originalResponse;
      globalThis.Request = originalRequest;
      globalThis.Headers = originalHeaders;
    }
  });
}
