import * as vscode from "vscode";

export function getIntegrationTab(webviewName: string) {
    const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
    console.log("All tabs:", tabs);
    return tabs.find((tab) => {
      const viewType = (tab.input as any)?.viewType;
      console.log("Tab view type:", viewType);
      return viewType?.endsWith(webviewName);
    });
}
