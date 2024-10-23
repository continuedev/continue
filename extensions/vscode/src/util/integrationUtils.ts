import * as vscode from "vscode";

export function getIntegrationTab(webviewName: string) {
    const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
    return tabs.find((tab) => {
      const viewType = (tab.input as any)?.viewType;
      return viewType?.endsWith(webviewName);
    });
}
