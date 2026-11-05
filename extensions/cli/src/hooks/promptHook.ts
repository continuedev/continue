import { fireUserPromptSubmit } from "./fireHook.js";

export interface PromptHookOutcome {
  /** The prompt to send: the original, plus any context the hooks added. */
  prompt: string;
  /** Set when a hook stopped the prompt; it is not sent to the model. */
  blockedReason?: string;
}

/**
 * Runs UserPromptSubmit hooks on a prompt before it joins the conversation.
 * A hook can stop it (exit 2, or a block decision) or add context, which is
 * appended to the prompt so the model sees it with the question.
 */
export async function runUserPromptSubmitHooks(
  prompt: string,
): Promise<PromptHookOutcome> {
  const result = await fireUserPromptSubmit(prompt);
  if (result.blocked) {
    return { prompt, blockedReason: result.blockReason ?? "Blocked by hook" };
  }
  if (result.additionalContext) {
    return {
      prompt: `${prompt}\n\n[Hook context]\n${result.additionalContext}`,
    };
  }
  return { prompt };
}

/** The message shown to the person when a hook stops their prompt. */
export function describePromptBlocked(reason: string): string {
  return `Your message was not sent: a hook blocked it. ${reason}`;
}
