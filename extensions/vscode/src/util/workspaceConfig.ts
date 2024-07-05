import { workspace } from "vscode";

export const CONTINUE_WORKSPACE_KEY = "continue";

export const continueWorkspaceConfig = workspace.getConfiguration(
  CONTINUE_WORKSPACE_KEY,
);
