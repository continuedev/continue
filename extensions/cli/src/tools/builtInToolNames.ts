/**
 * List of built-in tool names
 * Kept separate from allBuiltIns.ts to avoid circular dependencies
 */
export const BUILT_IN_TOOL_NAMES = [
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "List",
  "Search",
  "Bash",
  "Fetch",
  "Checklist",
  "ReportFailure",
  "Exit",
  "Diff",
  "LS",
  "Glob",
  "Grep",
  "NotebookRead",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Subagent",
] as const;

export type BuiltInToolName = (typeof BUILT_IN_TOOL_NAMES)[number];
