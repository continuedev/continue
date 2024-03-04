import * as vscode from "vscode";

const statusBarItemText = (enabled: boolean | undefined) =>
  enabled ? "$(check) Continue" : "$(circle-slash) Continue";

const statusBarItemTooltip = (enabled: boolean | undefined) =>
  enabled ? "Tab autocomplete is enabled" : "Click to enable tab autocomplete";

let lastStatusBar: vscode.StatusBarItem | undefined = undefined;
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

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  statusBarItem.text = loading
    ? "$(loading~spin) Continue"
    : statusBarItemText(enabled);
  statusBarItem.tooltip = statusBarItemTooltip(enabled);
  statusBarItem.command = "continue.toggleTabAutocompleteEnabled";

  // Swap out with old status bar
  if (lastStatusBar) {
    lastStatusBar.dispose();
  }
  statusBarItem.show();
  lastStatusBar = statusBarItem;

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("continue")) {
      const config = vscode.workspace.getConfiguration("continue");
      const enabled = config.get<boolean>("enableTabAutocomplete");
      statusBarItem.dispose();
      setupStatusBar(enabled);
    }
  });
}
