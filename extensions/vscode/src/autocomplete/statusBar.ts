import * as vscode from "vscode";

const statusBarItemText = (enabled: boolean | undefined) =>
  enabled ? "$(check) Continue" : "$(circle-slash) Continue";

const statusBarItemTooltip = (enabled: boolean | undefined) =>
  enabled ? "Tab autocomplete is enabled" : "Click to enable tab autocomplete";

let statusBarItem: vscode.StatusBarItem | undefined = undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined = undefined;

export function stopStatusBarLoading() {
  statusBarFalseTimeout = setTimeout(() => {
    setupStatusBar(true, false);
  }, 100);
}

export function setupStatusBar(
  enabled: boolean | undefined,
  loading?: boolean,
) {
  if (loading !== false) {
    clearTimeout(statusBarFalseTimeout);
    statusBarFalseTimeout = undefined;
  }

  // If statusBarItem hasn't been defined yet, create it
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
    );
  }

  statusBarItem.text = loading
    ? "$(loading~spin) Continue"
    : statusBarItemText(enabled);
  statusBarItem.tooltip = statusBarItemTooltip(enabled);
  statusBarItem.command = "continue.toggleTabAutocompleteEnabled";

  statusBarItem.show();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("continue")) {
      const config = vscode.workspace.getConfiguration("continue");
      const enabled = config.get<boolean>("enableTabAutocomplete");
      setupStatusBar(enabled);
    }
  });
}
