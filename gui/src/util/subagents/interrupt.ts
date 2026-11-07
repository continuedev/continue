import type { ChatHistoryItem, ContextItem, SubagentRunState } from "core";
import {
  formatSubagentResult,
  isSubagentRunFinished,
} from "core/subagents/result";

export const INTERRUPTED_REASON = "The window was reloaded while it ran";

/** The context item the parent model reads as a subagent's result. */
export function subagentResultItem(run: SubagentRunState): ContextItem {
  return {
    name: `${run.agent} report`,
    description: `Subagent ${run.status}`,
    content: formatSubagentResult({
      agent: run.agent,
      status: run.status,
      response: run.text,
      error: run.error,
      toolCalls: run.toolCalls,
    }),
    hidden: false,
  };
}

/**
 * For a session being loaded: a subagent that was still queued or running
 * when the session was saved cannot be resumed, so it is marked interrupted,
 * and its tool call ends with what the subagent had produced, so the parent
 * conversation can carry on from it. Mutates `history` (an immer draft).
 */
export function interruptSubagentRuns(history: ChatHistoryItem[]): void {
  for (const item of history) {
    for (const call of item.toolCallStates ?? []) {
      const run = call.subagent;
      if (!run || isSubagentRunFinished(run.status)) continue;
      run.status = "interrupted";
      run.error = INTERRUPTED_REASON;
      run.pendingApproval = undefined;
      run.endedAt = run.endedAt ?? Date.now();
      run.toolCalls = run.toolCalls.map((c) =>
        c.status === "calling" || c.status === "generated"
          ? { ...c, status: "canceled" }
          : c,
      );
      if (call.status === "calling" || call.status === "generated") {
        call.status = "done";
        call.output = [subagentResultItem(run)];
      }
    }
  }
}
