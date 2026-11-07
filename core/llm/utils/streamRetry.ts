/**
 * A dropped connection while a streamed response is being read (node-fetch:
 * "Invalid response body while trying to fetch ...: aborted", undici:
 * "terminated", a premature close, ECONNRESET) never reaches the fetch-level
 * retry, which only sees the request, and neither does an "overloaded" error
 * event sent inside a 200 stream. This retries the whole request when either
 * happens before anything was handed to the caller. A dropped connection after
 * that is not retried (the caller already has part of the reply) but gets a
 * message that says what happened instead of node-fetch's wording.
 */

const RETRY_DELAYS_MS = [1000, 3000];

const DROPPED_CODES = new Set([
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN", // DNS not answering, e.g. right after a laptop wakes up
  "ENETUNREACH",
  "ENETDOWN",
  "EHOSTUNREACH",
  "ERR_STREAM_PREMATURE_CLOSE",
  "UND_ERR_SOCKET",
]);

const SDK_RETRIED_MESSAGES = new Set([
  "Request timed out.",
  "Connection error.",
]);
const SDK_RETRIED_NAMES = new Set([
  "APIConnectionError",
  "APIConnectionTimeoutError",
]);

/** An OpenAI SDK connection error, which the SDK has retried already. */
function alreadyRetriedBySdk(e: { name?: string; message?: string }): boolean {
  return (
    SDK_RETRIED_NAMES.has(e.name ?? "") ||
    SDK_RETRIED_NAMES.has(
      (e as { constructor?: { name?: string } }).constructor?.name ?? "",
    ) ||
    SDK_RETRIED_MESSAGES.has(e.message ?? "")
  );
}

export function isDroppedConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    code?: string;
    message?: string;
    cause?: { code?: string };
  };
  if (e.name === "AbortError") return false;
  // The OpenAI SDK retries a failed connection itself before throwing these
  // (see retryPolicy.ts); retrying the whole request again here multiplied
  // the tries, up to nine, each waiting out a timeout. Its classes do not set
  // `name`, and the extension bundle renames classes, so their fixed
  // messages identify them.
  if (alreadyRetriedBySdk(e)) return false;
  if (
    DROPPED_CODES.has(e.code ?? "") ||
    DROPPED_CODES.has(e.cause?.code ?? "")
  ) {
    return true;
  }
  const message = (e.message ?? "").toLowerCase();
  return (
    message.includes("invalid response body while trying to fetch") ||
    message.includes("premature close") ||
    message.includes("socket hang up") ||
    message.includes("ended before the response was complete") ||
    message === "terminated"
  );
}

/**
 * An error event inside a 200 stream that says to try again: Anthropic sends
 * `overloaded_error` and `api_error` ("Internal server error") this way, and
 * they surface from parseDataLine as "Error streaming response: ...".
 */
export function isTransientStreamError(error: unknown): boolean {
  const message = (
    (error as { message?: string })?.message ?? ""
  ).toLowerCase();
  return (
    message.startsWith("error streaming response:") &&
    (message.includes("overloaded") ||
      message.includes("internal server error") ||
      message.includes("api_error"))
  );
}

function hostOf(error: unknown): string | undefined {
  const match = /trying to fetch (\S+?): /.exec(
    (error as { message?: string })?.message ?? "",
  );
  if (!match) return undefined;
  try {
    return new URL(match[1]).host;
  } catch {
    return undefined;
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function* retryStreamOnDroppedConnection<T>(
  start: () => AsyncIterable<T>,
  signal?: AbortSignal,
  delaysMs: number[] = RETRY_DELAYS_MS,
): AsyncGenerator<T> {
  for (let attempt = 0; ; attempt++) {
    let yielded = false;
    try {
      for await (const chunk of start()) {
        yielded = true;
        yield chunk;
      }
      return;
    } catch (error) {
      if (signal?.aborted) throw error;
      const dropped = isDroppedConnectionError(error);
      const transient = !dropped && isTransientStreamError(error);
      if (!dropped && !transient) throw error;

      if (!yielded && attempt < delaysMs.length) {
        console.warn(
          `${dropped ? "Connection dropped" : "Server asked to retry"} before the response started; retrying (${attempt + 1}/${delaysMs.length}).`,
          error,
        );
        await sleep(delaysMs[attempt], signal);
        if (signal?.aborted) return;
        continue;
      }

      if (transient) throw error;

      const host = hostOf(error);
      const where = host ? ` to ${host}` : "";
      const message = yielded
        ? `The connection${where} closed in the middle of the response, so the reply is incomplete. Resubmit to try again.`
        : `The connection${where} closed before the response arrived (tried ${attempt + 1} times). Check your network or proxy and resubmit.`;
      throw new Error(`${message} (${(error as Error).message})`, {
        cause: error,
      });
    }
  }
}
