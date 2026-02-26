/**
 * Static list of built-in tool names.
 * Kept separate from allBuiltIns.ts to avoid circular dependency:
 * ToolPermissionService -> allBuiltIns -> runTerminalCommand -> services/index -> ToolPermissionService
 *
 * When adding a new built-in tool, update both this list and ALL_BUILT_IN_TOOLS in allBuiltIns.ts.
 */
export const BUILT_IN_TOOL_NAMES = [
  "AskQuestion",
  "Edit",
  "Exit",
  "Fetch",
  "List",
  "MultiEdit",
  "Read",
  "ReportFailure",
  "Bash",
  "Search",
  "Status",
  "Subagent",
  "Skills",
  "UploadArtifact",
  "Diff",
  "Checklist",
  "Write",
] as const;
