export enum BuiltInToolNames {
  ReadFile = "builtin_read_file",
  EditExistingFile = "builtin_edit_existing_file",
  ReadCurrentlyOpenFile = "builtin_read_currently_open_file",
  CreateNewFile = "builtin_create_new_file",
  RunTerminalCommand = "builtin_run_terminal_command",
  GrepSearch = "builtin_grep_search",
  FileGlobSearch = "builtin_file_glob_search",
  SearchWeb = "builtin_search_web",
  ViewDiff = "builtin_view_diff",
  LSTool = "builtin_ls",
  CreateRuleBlock = "builtin_create_rule_block",

  // excluded from allTools for now
  ViewRepoMap = "builtin_view_repo_map",
  ViewSubdirectory = "builtin_view_subdirectory",
}

export const CHAT_UNSAFE_TOOLS: string[] = [ BuiltInToolNames.EditExistingFile, BuiltInToolNames.CreateNewFile, BuiltInToolNames.RunTerminalCommand ];

export const BUILT_IN_GROUP_NAME = "Built-In";

export const CLIENT_TOOLS = [BuiltInToolNames.EditExistingFile];
