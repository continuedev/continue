/**
 * A failure that is likely to pass on its own: a rate limit, an overloaded
 * or unavailable server, or a lost connection. Core has already retried it
 * by its retry policy (core/llm/utils/retryPolicy.ts) and, for a model with
 * routes, tried the other accounts; what is left is the person's call: try
 * again now, wait and try again, or pick another model.
 */
export interface TransientFailure {
  kind: "rate-limit" | "overloaded" | "connection";
  /** How long to wait before trying again: the server's, or a default. */
  waitSeconds: number;
  /** True when the server said how long. */
  waitFromServer: boolean;
}

const DEFAULT_WAIT_SECONDS: Record<TransientFailure["kind"], number> = {
  "rate-limit": 30,
  overloaded: 20,
  connection: 15,
};

/** Longest automatic wait offered; anything longer is left to the person. */
export const MAX_AUTO_RETRY_SECONDS = 600;

export function transientFailure(
  statusCode: number | undefined,
  message: string | undefined,
): TransientFailure | undefined {
  const text = (message ?? "").toLowerCase();
  let kind: TransientFailure["kind"] | undefined;
  if (statusCode === 429 || /rate limit|too many requests|throttl/.test(text)) {
    kind = "rate-limit";
  } else if (
    statusCode === 503 ||
    statusCode === 529 ||
    /overloaded|service unavailable|asked to wait/.test(text)
  ) {
    kind = "overloaded";
  } else if (
    /closed before the response arrived|timed out|econnrefused|econnreset|enotfound|etimedout|fetch failed|socket hang up|network/.test(
      text,
    )
  ) {
    kind = "connection";
  }
  if (!kind) return undefined;

  // RetryWaitTooLongError: "The server asked to wait 3600 s ..."
  const asked = /asked to wait (\d+) s/.exec(message ?? "");
  const waitSeconds = asked ? Number(asked[1]) : DEFAULT_WAIT_SECONDS[kind];
  return { kind, waitSeconds, waitFromServer: !!asked };
}

export function describeTransientFailure(
  failure: TransientFailure,
  modelTitle: string,
): string {
  switch (failure.kind) {
    case "rate-limit":
      return `${modelTitle} is rate limited right now: the provider is refusing more requests for a while.`;
    case "overloaded":
      return `${modelTitle}'s server is overloaded or unavailable for the moment.`;
    case "connection":
      return `The connection to ${modelTitle} failed, so no reply arrived. Check the network, proxy or local server.`;
  }
}

/** "45 s", "3 min", "1 h 5 min". */
export function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
