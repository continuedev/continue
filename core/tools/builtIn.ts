export enum BuiltInToolNames {
  ReadFile = "builtin_read_file",
  EditExistingFile = "builtin_edit_existing_file",
  ReadCurrentlyOpenFile = "builtin_read_currently_open_file",
  CreateNewFile = "builtin_create_new_file",
  RunTerminalCommand = "builtin_run_terminal_command",
  ExactSearch = "builtin_exact_search",
  SearchWeb = "builtin_search_web",
  ViewDiff = "builtin_view_diff",
  LSTool = "builtin_ls",

  // excluded from allTools for now
  ViewRepoMap = "builtin_view_repo_map",
  ViewSubdirectory = "builtin_view_subdirectory",
}

export const BUILT_IN_GROUP_NAME = "Built-In";
