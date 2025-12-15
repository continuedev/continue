/**
 * List of built-in tool names
 * Kept separate from allBuiltIns.ts to avoid circular dependencies
 */
export const BUILT_IN_TOOL_NAMES = [
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "List",
  "Search",
  "Bash",
  "Fetch",
  "Checklist",
  "Subagent",
  "Exit",
  "ReportFailure",
  "UploadArtifact",
] as const;

export type BuiltInToolName = (typeof BUILT_IN_TOOL_NAMES)[number];
