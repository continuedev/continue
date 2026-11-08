import type { ILLM } from "../../..";
import { parseReviewerReply, ReviewResult } from "./parse";
import { buildReviewMessages, newNonce, ReviewPromptInput } from "./prompt";

export const DEFAULT_REVIEW_TIMEOUT_MS = 15_000;

export interface ReviewOptions {
  timeoutMs?: number;
  /** Aborts the review, for example when the user stops the agent. */
  signal?: AbortSignal;
  /** No person to ask (CLI): an unusable reviewer refuses instead of asking. */
  headless?: boolean;
  nonce?: string;
  /** `modeModels.reviewer.reasoningEffort`: thinking on or off, and its budget. */
  reasoning?: ReviewerReasoning;
}

/** How much the reviewer may think before it answers. */
export interface ReviewerReasoning {
  reasoning: boolean;
  reasoningBudgetTokens?: number;
}

/** The verdict is short; thinking, when on, needs its budget on top. */
export const REVIEW_MAX_TOKENS = 300;

/** Completion options for one review: temperature 0, plus the reasoning setting. */
export function reviewCompletionOptions(reasoning?: ReviewerReasoning): {
  temperature: number;
  maxTokens: number;
  reasoning?: boolean;
  reasoningBudgetTokens?: number;
} {
  const base = { temperature: 0, maxTokens: REVIEW_MAX_TOKENS };
  if (!reasoning) return base;
  if (!reasoning.reasoning) return { ...base, reasoning: false };
  const budget = reasoning.reasoningBudgetTokens ?? 0;
  return {
    ...base,
    maxTokens: REVIEW_MAX_TOKENS + budget,
    reasoning: true,
    ...(budget > 0 ? { reasoningBudgetTokens: budget } : {}),
  };
}

export function unavailable(why: string, headless?: boolean): ReviewResult {
  return {
    decision: headless ? "deny" : "ask",
    category: "reviewer-unavailable",
    reason: headless
      ? `${why} No one is available to ask, so the call is refused.`
      : why,
  };
}

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === "object" && "text" in p ? String(p.text) : "",
      )
      .join("");
  }
  return "";
}

/**
 * Ask the reviewer model about one call. Never throws: an error, a timeout or
 * an empty reply is "ask" (or "deny" with nobody to ask). Temperature 0.
 */
export async function reviewToolCall(
  llm: Pick<ILLM, "chat">,
  input: Omit<ReviewPromptInput, "nonce">,
  opts: ReviewOptions = {},
): Promise<ReviewResult> {
  const messages = buildReviewMessages({
    ...input,
    nonce: opts.nonce ?? newNonce(),
  });

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? DEFAULT_REVIEW_TIMEOUT_MS);

  try {
    if (opts.signal?.aborted) controller.abort();
    const reply = await llm.chat(
      messages,
      controller.signal,
      reviewCompletionOptions(opts.reasoning),
    );
    const text = messageText(reply?.content);
    if (!text.trim()) {
      return unavailable("The reviewer model returned nothing.", opts.headless);
    }
    return parseReviewerReply(text);
  } catch (e) {
    const why = timedOut
      ? "The reviewer model did not answer in time."
      : `The reviewer model failed: ${e instanceof Error ? e.message : String(e)}.`;
    return unavailable(why, opts.headless);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
