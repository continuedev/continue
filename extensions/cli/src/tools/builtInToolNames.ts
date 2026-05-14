/**
 * Static list of built-in tool names.
 * Kept separate from allBuiltIns.ts to avoid circular dependency:
 * ToolPermissionService -> allBuiltIns -> runTerminalCommand -> services/index -> ToolPermissionService
 *
 * When adding a new built-in tool, update both this list and ALL_BUILT_IN_TOOLS in allBuiltIns.ts.
 *
 * Tools migrated to core (Phase 2+3) use snake_case names matching BuiltInToolNames:
 *   - "file_glob_search" (was "Glob")
 *   - "git" (was "Git")
 *   - "github" (was "GitHub")
 *   - "grep_search" (was "Grep")
 *   - "list_mcp_resources" (was "ListMcpResources")
 *   - "ls" (was "List")
 *   - "mcp_auth" (was "McpAuth")
 *   - "read_file" (was "Read")
 *   - "read_mcp_resource" (was "ReadMcpResource")
 *   - "search_web" (was "WebSearch")
 *   - "send_message" (was "SendMessage")
 *   - "sleep" (was "Sleep")
 *   - "task_create/get/list/output/stop/update" (were "Task*")
 *   - "tool_search" (was "ToolSearch")
 *   - "todo_write" (was "TodoWrite")
 *   - "view_diff" (was "Diff")
 */
export const BUILT_IN_TOOL_NAMES = [
  // CLI-specific tools (unchanged names)
  "AskQuestion",
  "Edit",
  "Exit",
  "Fetch",
  "MultiEdit",
  "ReportFailure",
  "Bash",
  "Search",
  "Status",
  "Subagent",
  "Skills",
  "UploadArtifact",
  "Checklist",
  "Write",
  // Core-backed tools (snake_case names from BuiltInToolNames)
  "file_glob_search",
  "git",
  "github",
  "grep_search",
  "list_mcp_resources",
  "ls",
  "mcp_auth",
  "read_file",
  "read_mcp_resource",
  "search_web",
  "send_message",
  "sleep",
  "task_create",
  "task_get",
  "task_list",
  "task_output",
  "task_stop",
  "task_update",
  "tool_search",
  "todo_write",
  "view_diff",
] as const;
