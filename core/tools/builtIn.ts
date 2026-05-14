export enum BuiltInToolNames {
  ReadFile = "read_file",
  ReadFileRange = "read_file_range",
  EditExistingFile = "edit_existing_file",
  SingleFindAndReplace = "single_find_and_replace",
  MultiEdit = "multi_edit",
  ReadCurrentlyOpenFile = "read_currently_open_file",
  CreateNewFile = "create_new_file",
  RunTerminalCommand = "run_terminal_command",
  GrepSearch = "grep_search",
  FileGlobSearch = "file_glob_search",
  SearchWeb = "search_web",
  ViewDiff = "view_diff",
  LSTool = "ls",
  CreateRuleBlock = "create_rule_block",
  RequestRule = "request_rule",
  FetchUrlContent = "fetch_url_content",
  CodebaseTool = "codebase",
  ReadSkill = "read_skill",
  Skill = "skill",

  // excluded from allTools for now
  ViewRepoMap = "view_repo_map",
  ViewSubdirectory = "view_subdirectory",

  // Agent todo tracking
  TodoWrite = "todo_write",
  TaskCreate = "task_create",
  TaskGet = "task_get",
  TaskList = "task_list",
  TaskOutput = "task_output",
  TaskStop = "task_stop",
  TaskUpdate = "task_update",

  // Agent user interaction
  AskUserQuestion = "ask_user_question",

  // LSP code intelligence
  LspQuery = "lsp_query",

  // Pause agent execution without shelling out
  Sleep = "sleep",

  // Jupyter notebook cell editing
  NotebookEdit = "notebook_edit",

  // Agent planning mode toggles
  EnterPlanMode = "enter_plan_mode",
  ExitPlanMode = "exit_plan_mode",

  // Nested specialized agent execution
  Subagent = "subagent",

  // Proactive user notifications (ported from Marcel BriefTool)
  NotifyUser = "notify_user",

  // Git worktree management
  EnterWorktree = "enter_worktree",
  ExitWorktree = "exit_worktree",

  // Tool discovery
  ToolSearch = "tool_search",

  // Repository helpers
  Git = "git",
  GitHub = "github",

  // MCP helpers
  ListMcpResources = "list_mcp_resources",
  ReadMcpResource = "read_mcp_resource",
  McpAuth = "mcp_auth",

  // Team and mailbox helpers
  TeamCreate = "team_create",
  TeamDelete = "team_delete",
  TeamStatus = "team_status",
  TeamMailbox = "team_mailbox",
  SendMessage = "send_message",

  // Runtime inspection helpers
  Config = "config",
  Status = "status",
}

export const BUILT_IN_GROUP_NAME = "Built-In";

export const CLIENT_TOOLS_IMPLS = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
  BuiltInToolNames.NotebookEdit,
  BuiltInToolNames.EnterPlanMode,
  BuiltInToolNames.ExitPlanMode,
];
