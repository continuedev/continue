import * as vscode from "vscode";
import { Battery } from "../util/battery";

export enum StatusBarStatus {
  Disabled,
  Enabled,
  Paused,
}

const statusBarItemText = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Disabled:
      return "$(circle-slash) Continue";
    case StatusBarStatus.Enabled:
      return "$(check) Continue";
    case StatusBarStatus.Paused:
      return "$(debug-pause) Continue";
  }
};

const statusBarItemTooltip = (status: StatusBarStatus | undefined) => {
  switch (status) {
    case undefined:
    case StatusBarStatus.Disabled:
      return "Click to enable tab autocomplete";
    case StatusBarStatus.Enabled:
      return "Tab autocomplete is enabled";
    case StatusBarStatus.Paused:
      return "Tab autocomplete is paused";
  }
};

let statusBarStatus: StatusBarStatus | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;
let statusBarFalseTimeout: NodeJS.Timeout | undefined = undefined;

export function stopStatusBarLoading() {
  statusBarFalseTimeout = setTimeout(() => {
    setupStatusBar(StatusBarStatus.Enabled, false);
  }, 100);
}

export function setupStatusBar(
  status: StatusBarStatus | undefined,
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
    : statusBarItemText(status);
  statusBarItem.tooltip = statusBarItemTooltip(status ?? statusBarStatus);
  statusBarItem.command = "continue.openTabAutocompleteConfigMenu";

  statusBarItem.show();
  if (status !== undefined) statusBarStatus = status;

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("continue")) {
      const config = vscode.workspace.getConfiguration("continue");
      const enabled = config.get<boolean>("enableTabAutocomplete");
      if (enabled && statusBarStatus === StatusBarStatus.Paused) return;
      setupStatusBar(
        enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
      );
    }
  });
}

export function getStatusBarStatus(): StatusBarStatus | undefined {
  return statusBarStatus;
}

export function monitorBatteryChanges(battery: Battery): vscode.Disposable {
  return battery.onChangeAC((acConnected: boolean) => {
    const config = vscode.workspace.getConfiguration("continue");
    const enabled = config.get<boolean>("enableTabAutocomplete");
    if (!!enabled) {
      const pauseOnBattery = config.get<boolean>(
        "pauseTabAutocompleteOnBattery",
      );
      setupStatusBar(
        acConnected || !pauseOnBattery
          ? StatusBarStatus.Enabled
          : StatusBarStatus.Paused,
      );
    }
  });
}
