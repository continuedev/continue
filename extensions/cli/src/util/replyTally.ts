/**
 * Replies the model could not finish: the provider ended them with
 * finish_reason "length", the output token limit. Counted per process, in
 * memory only, so the usage summary can say how many replies were cut off
 * instead of passing them off as complete.
 */
let truncated = 0;

export const TRUNCATED_REPLY_MESSAGE =
  "The reply was cut off at the model's output limit (finish_reason: length) and may be incomplete; raise maxTokens in the model's defaultCompletionOptions for longer replies.";

export function recordTruncatedReply(): void {
  truncated += 1;
}

export function getTruncatedReplies(): number {
  return truncated;
}

export function resetReplyTally(): void {
  truncated = 0;
}

/** One line for a usage summary, or undefined when no reply was cut off. */
export function formatReplyTally(
  count: number = truncated,
): string | undefined {
  if (count === 0) return undefined;
  return `Replies cut off at the output limit: ${count.toLocaleString("en-US")}`;
}
