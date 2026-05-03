/**
 * AsyncLocalStorage-based agent identity context for concurrent subagent runs.
 *
 * WHY AsyncLocalStorage (not shared module-level state):
 * When multiple subagents run concurrently in the same process, shared state
 * would be overwritten, causing one agent's operations to be attributed to
 * another. AsyncLocalStorage isolates each async execution chain so concurrent
 * agents never interfere with each other.
 *
 * Ported from Marcel (src/utils/agentContext.ts), trimmed to the subagent
 * use-case only (no swarm/teammate context).
 */

import { AsyncLocalStorage } from "async_hooks";

/** Identity context for a subagent spawned via the Subagent tool. */
export type SubagentContext = {
  /** Unique ID for this subagent invocation. */
  agentId: string;
  /** Session ID of the parent agent that spawned this subagent. */
  parentSessionId?: string;
  /** Discriminant for this context type. */
  agentType: "subagent";
  /**
   * Display/type name for the subagent (e.g., "Explore", "code-reviewer",
   * or the user-supplied description).
   */
  subagentName?: string;
  /** True when this is a built-in named subagent vs. a one-off prompt. */
  isBuiltIn?: boolean;
};

const agentContextStorage = new AsyncLocalStorage<SubagentContext>();

/**
 * Get the SubagentContext for the currently executing async chain, if any.
 * Returns undefined when called outside a subagent context (e.g. the main
 * agent loop).
 */
export function getSubagentContext(): SubagentContext | undefined {
  return agentContextStorage.getStore();
}

/**
 * Run `fn` with the given SubagentContext bound to the current async chain.
 * All async operations inside `fn` (and anything they await) will see this
 * context via `getSubagentContext()`.
 */
export function runWithSubagentContext<T>(
  context: SubagentContext,
  fn: () => T,
): T {
  return agentContextStorage.run(context, fn);
}

/**
 * Returns true when there is an active subagent context on the current chain.
 */
export function isInSubagentContext(): boolean {
  return agentContextStorage.getStore() !== undefined;
}
