/**
 * Hook calls around a tool call, kept apart from the permission and execution
 * code in streamChatResponse.helpers.ts.
 *
 * A hook can block a call, change its arguments, or add context for the model.
 * Order for one call: PreToolUse hooks run first, so the permission check sees
 * the final arguments; a hook can tighten what the permission policy decided
 * but never loosen a policy "exclude" (see checkToolPermissionApproval).
 */

import {
  firePostToolUse,
  firePostToolUseFailure,
  firePreToolUse,
} from "../hooks/fireHook.js";
import { validateToolCallArgsPresent } from "../tools/index.js";
import type { PreprocessedToolCall } from "../tools/types.js";
import { logger } from "../util/logger.js";

export interface PreToolHookOutcome {
  /** The call to run: the original, or a copy with arguments a hook replaced. */
  call: PreprocessedToolCall;
  /** Set when a hook stopped the call; the model is told this. */
  blockedReason?: string;
  /** What the hooks asked of the permission check, if anything. */
  decision?: "allow" | "ask";
}

export async function runPreToolUseHooks(
  call: PreprocessedToolCall,
): Promise<PreToolHookOutcome> {
  const result = await firePreToolUse(call.name, call.arguments, call.id);

  if (result.blocked) {
    return { call, blockedReason: result.blockReason ?? "Blocked by hook" };
  }

  let next = call;
  if (result.updatedInput) {
    // The new arguments go through the same steps the model's did, so a hook
    // cannot hand a tool something it would have refused.
    try {
      const candidate = { ...call, arguments: result.updatedInput };
      validateToolCallArgsPresent(candidate, call.tool);
      const preprocessResult = call.tool.preprocess
        ? await call.tool.preprocess(result.updatedInput)
        : undefined;
      next = { ...candidate, preprocessResult };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        call,
        blockedReason: `A hook changed the arguments of ${call.name} to something the tool rejects: ${detail}`,
      };
    }
  }

  const decision =
    result.permissionDecision === "allow" || result.permissionDecision === "ask"
      ? result.permissionDecision
      : undefined;
  return { call: next, decision };
}

/**
 * Runs PostToolUse hooks and returns the tool result with any context the
 * hooks added. The call has already happened, so nothing here can undo it and
 * a failing hook never turns a successful call into an error.
 */
export async function runPostToolUseHooks(
  call: PreprocessedToolCall,
  toolResult: string,
): Promise<string> {
  try {
    const result = await firePostToolUse(
      call.name,
      call.arguments,
      toolResult,
      call.id,
    );
    const notes: string[] = [];
    if (result.blocked && result.blockReason) {
      notes.push(`A hook flagged this result: ${result.blockReason}`);
    }
    if (result.additionalContext) notes.push(result.additionalContext);
    return notes.length > 0
      ? `${toolResult}\n\n[Hook output]\n${notes.join("\n")}`
      : toolResult;
  } catch (error) {
    logger.warn(`PostToolUse hooks failed for ${call.name}`, error);
    return toolResult;
  }
}

export async function runPostToolUseFailureHooks(
  call: PreprocessedToolCall,
  error: string,
): Promise<void> {
  try {
    await firePostToolUseFailure(call.name, call.arguments, call.id, error);
  } catch (hookError) {
    logger.warn(`PostToolUseFailure hooks failed for ${call.name}`, hookError);
  }
}
