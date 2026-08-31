/**
 * Hard cap on how many model round-trips one subagent may take before it is
 * forced to report back. Only applies to providers we drive ourselves; the
 * Claude Code CLI runs its own internal loop that we don't step.
 */
export const SUBAGENT_MAX_ITERATIONS = 25;

/** How many subagents from one spawn_subagents call may run at once. */
export const SUBAGENT_MAX_CONCURRENCY = 5;

export const NO_TOOL_CALL_OUTPUT_MESSAGE = "No tool output";
export const CANCELLED_TOOL_CALL_MESSAGE = "The user cancelled this tool call.";
export const ERRORED_TOOL_CALL_OUTPUT_MESSAGE =
  "There was an error calling the tool.";
