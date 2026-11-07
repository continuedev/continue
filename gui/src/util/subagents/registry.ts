import {
  MAX_CONCURRENT_SUBAGENTS,
  PrefixGate,
  Semaphore,
} from "core/subagents/scheduling";

/**
 * What a running subagent needs outside redux: its abort controller (for the
 * card's Stop) and the resolver of a call waiting for approval. Neither can
 * be serialized, and neither outlives the window: after a reload the run is
 * marked interrupted instead (see interrupt.ts).
 */
const runs = new Map<string, AbortController>();
const approvals = new Map<string, (allowed: boolean) => void>();

/** Shared by every run in this window. */
export const subagentSlots = new Semaphore(MAX_CONCURRENT_SUBAGENTS);
export const subagentPrefixGate = new PrefixGate();

export const STOPPED_BY_USER = "Stopped by the user";

export function registerSubagentRun(
  toolCallId: string,
  controller: AbortController,
): () => void {
  runs.set(toolCallId, controller);
  return () => {
    if (runs.get(toolCallId) === controller) runs.delete(toolCallId);
  };
}

/** The card's Stop: cancels one run; its parent keeps going. */
export function stopSubagentRun(toolCallId: string): boolean {
  const controller = runs.get(toolCallId);
  if (!controller) return false;
  controller.abort(new Error(STOPPED_BY_USER));
  return true;
}

export function isSubagentRunLive(toolCallId: string): boolean {
  return runs.has(toolCallId);
}

/**
 * Wait for the person to allow or reject one of a subagent's calls. Resolves
 * false (rejected) if the run is cancelled first.
 */
export function waitForSubagentApproval(
  approvalId: string,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const done = (allowed: boolean) => {
      approvals.delete(approvalId);
      signal.removeEventListener("abort", onAbort);
      resolve(allowed);
    };
    const onAbort = () => done(false);
    approvals.set(approvalId, done);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The card's Allow and Reject buttons. */
export function answerSubagentApproval(
  approvalId: string,
  allowed: boolean,
): boolean {
  const resolve = approvals.get(approvalId);
  if (!resolve) return false;
  resolve(allowed);
  return true;
}
