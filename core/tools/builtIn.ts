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
  SpawnSubagents = "spawn_subagents",

  // Shadow chat history tools — backed by the local per-session SQLite cache
  ShadowGetChatHistory = "shadow_get_chat_history",
  ShadowSearchMessages = "shadow_search_messages",
  ShadowSemanticSearch = "shadow_semantic_search",
  ShadowGetConversationStats = "shadow_get_conversation_stats",
  ShadowGetToolResult = "shadow_get_tool_result",
  ShadowSearchAllSessions = "shadow_search_all_sessions",
  ShadowSemanticSearchAllSessions = "shadow_semantic_search_all_sessions",

  // excluded from allTools for now
  ViewRepoMap = "view_repo_map",
  ViewSubdirectory = "view_subdirectory",
}

export const BUILT_IN_GROUP_NAME = "Built-In";

export const SHADOW_TOOL_NAMES: ReadonlySet<string> = new Set([
  BuiltInToolNames.ShadowGetChatHistory,
  BuiltInToolNames.ShadowSearchMessages,
  BuiltInToolNames.ShadowSemanticSearch,
  BuiltInToolNames.ShadowGetConversationStats,
  BuiltInToolNames.ShadowGetToolResult,
  BuiltInToolNames.ShadowSearchAllSessions,
  BuiltInToolNames.ShadowSemanticSearchAllSessions,
]);

export const CLIENT_TOOLS_IMPLS = [
  BuiltInToolNames.EditExistingFile,
  BuiltInToolNames.SingleFindAndReplace,
  BuiltInToolNames.MultiEdit,
];
