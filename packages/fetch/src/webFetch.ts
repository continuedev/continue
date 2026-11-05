import * as http from "node:http";
import * as https from "node:https";
import { Readable } from "node:stream";
import { createAgentForUrl } from "./agent.js";
import { RequestOptions } from "./types.js";

const MAX_REDIRECTS = 10;
/** Credentials a redirect to another origin must not carry (as browsers and node-fetch do). */
const CREDENTIAL_HEADERS = [
  "authorization",
  "cookie",
  "cookie2",
  "proxy-authorization",
  "www-authenticate",
];
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

type WebFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function toUrl(input: string | URL | Request): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function toHeaders(init: RequestInit | undefined, input: unknown): Headers {
  const headers = new Headers(
    input && typeof input === "object" && "headers" in input
      ? ((input as Request).headers as HeadersInit)
      : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

/** Bodies the MCP SDK and OAuth helpers send: strings, form data, bytes. */
async function toBuffer(body: unknown): Promise<Buffer | undefined> {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof (body as Blob).arrayBuffer === "function") {
    return Buffer.from(await (body as Blob).arrayBuffer());
  }
  if (typeof (body as ReadableStream).getReader === "function") {
    const chunks: Uint8Array[] = [];
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  throw new TypeError("Unsupported request body type");
}

/**
 * A standards-style `fetch` (returns a real `Response` with a streaming body)
 * that sends requests through the same agent as `fetchwithRequestOptions`:
 * proxy / `noProxy`, `caBundlePath`, the system CA store, client certificate
 * and `verifySsl`.
 *
 * For libraries that take a `fetch` but would otherwise use the runtime's own
 * (which ignores these settings), such as the MCP SDK. `fetchwithRequestOptions`
 * itself returns node-fetch responses, which those libraries can't use.
 */
export function createWebFetch(requestOptions?: RequestOptions): WebFetch {
  return async function webFetch(input, init) {
    const method = (
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase();
    const signal = init?.signal ?? undefined;
    const buffer = await toBuffer(init?.body);
    let headers = toHeaders(init, input);
    let url = toUrl(input);
    let redirectsLeft = MAX_REDIRECTS;
    let currentMethod = method;
    let currentBody = buffer;
    const redirect = init?.redirect ?? "follow";

    for (;;) {
      const { agent } = await createAgentForUrl(url, requestOptions);
      const response = await new Promise<Response>((resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
          return;
        }
        const transport = url.protocol === "https:" ? https : http;
        const requestHeaders: Record<string, string> = {};
        headers.forEach((value, key) => {
          requestHeaders[key] = value;
        });
        if (currentBody && !headers.has("content-length")) {
          requestHeaders["content-length"] = String(currentBody.length);
        }
        const req = transport.request(
          url,
          { method: currentMethod, headers: requestHeaders, agent },
          (res) => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (Array.isArray(value)) {
                value.forEach((v) => responseHeaders.append(key, v));
              } else if (value !== undefined) {
                responseHeaders.set(key, value);
              }
            }
            const status = res.statusCode ?? 0;
            const noBody =
              NULL_BODY_STATUSES.has(status) || currentMethod === "HEAD";
            if (noBody) res.resume();
            const result = new Response(
              noBody ? null : (Readable.toWeb(res) as ReadableStream),
              {
                status,
                statusText: res.statusMessage ?? "",
                headers: responseHeaders,
              },
            );
            Object.defineProperty(result, "url", { value: url.toString() });
            resolve(result);
          },
        );
        req.on("error", reject);
        signal?.addEventListener(
          "abort",
          () => {
            const reason =
              signal.reason ?? new DOMException("Aborted", "AbortError");
            req.destroy(reason instanceof Error ? reason : undefined);
            reject(reason);
          },
          { once: true },
        );
        if (currentBody) req.write(currentBody);
        req.end();
      });

      const location = response.headers.get("location");
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
      if (isRedirect && location && redirect === "follow") {
        if (redirectsLeft-- <= 0) {
          throw new TypeError("Too many redirects");
        }
        void response.body?.cancel().catch(() => {});
        const next = new URL(location, url);
        // An MCP server's bearer token or cookie must not follow a redirect
        // to some other host, or from https down to http.
        if (next.origin !== url.origin) {
          headers = new Headers(headers);
          for (const name of CREDENTIAL_HEADERS) headers.delete(name);
        }
        url = next;
        // 303, and 301/302 for POST, switch to GET without a body (like browsers)
        if (
          response.status === 303 ||
          ((response.status === 301 || response.status === 302) &&
            currentMethod === "POST")
        ) {
          currentMethod = "GET";
          currentBody = undefined;
          headers = new Headers(headers);
          headers.delete("content-type");
        }
        continue;
      }
      if (isRedirect && redirect === "error") {
        throw new TypeError(`Unexpected redirect to ${location}`);
      }
      return response;
    }
  };
}
