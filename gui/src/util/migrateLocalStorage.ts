import { ToolPolicy } from "@continuedev/terminal-security";
import { BuiltInToolNames } from "core/tools/builtIn";
import { clearToolPolicy, setToolPolicy } from "../redux/slices/uiSlice";
import { AppDispatch } from "../redux/store";

const validPolicyValues: ToolPolicy[] = [
  "allowedWithPermission",
  "allowedWithoutPermission",
  "disabled",
];
function migrateToolPolicies(dispatch: AppDispatch) {
  const toFromMap: Record<string, string[]> = {
    [BuiltInToolNames.ReadFile]: ["builtin_read_file"],
    [BuiltInToolNames.EditExistingFile]: ["builtin_edit_existing_file"],
    [BuiltInToolNames.ReadCurrentlyOpenFile]: [
      "builtin_read_currently_open_file",
    ],
    [BuiltInToolNames.CreateNewFile]: ["builtin_create_new_file"],
    [BuiltInToolNames.RunTerminalCommand]: ["builtin_run_terminal_command"],
    [BuiltInToolNames.GrepSearch]: ["builtin_grep_search"],
    [BuiltInToolNames.FileGlobSearch]: ["builtin_file_glob_search"],
    [BuiltInToolNames.SearchWeb]: ["builtin_search_web"],
    [BuiltInToolNames.ViewDiff]: ["builtin_view_diff"],
    [BuiltInToolNames.LSTool]: ["builtin_ls"],
    [BuiltInToolNames.CreateRuleBlock]: ["builtin_create_rule_block"],
    [BuiltInToolNames.RequestRule]: ["builtin_request_rule"],
    [BuiltInToolNames.FetchUrlContent]: ["builtin_fetch_url_content"],
    [BuiltInToolNames.CodebaseTool]: ["builtin_codebase"],
    [BuiltInToolNames.ViewRepoMap]: ["builtin_view_repo_map"],
    [BuiltInToolNames.ViewSubdirectory]: ["builtin_view_subdirectory"],
  };
  const persistedRedux = localStorage.getItem("persist:root");
  if (persistedRedux) {
    const uiState = JSON.parse(persistedRedux)?.ui;
    if (uiState) {
      const parsedSettings = JSON.parse(uiState)?.toolSettings;
      if (parsedSettings) {
        let migratedToolSettings = 0;
        Object.entries(toFromMap).forEach(([newToolName, oldToolNames]) => {
          for (const tool of oldToolNames) {
            if (
              tool in parsedSettings &&
              validPolicyValues.includes(parsedSettings[tool])
            ) {
              dispatch(
                setToolPolicy({
                  toolName: newToolName,
                  policy: parsedSettings[tool],
                }),
              );
              dispatch(clearToolPolicy(tool));
              migratedToolSettings++;
            }
          }
        });
        if (migratedToolSettings > 0) {
          console.log(
            `Migrated ${migratedToolSettings} tool policies successfully.`,
          );
        }
      }
    }
  }
}

export function migrateLocalStorage(dispatch: AppDispatch) {
  migrateToolPolicies(dispatch);
}
