import * as vscode from "vscode";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { ToWebviewProtocol } from "core/protocol";


export function getIntegrationTab(webviewName: string) {
    const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
    return tabs.find((tab) => {
      const viewType = (tab.input as any)?.viewType;
      return viewType?.endsWith(webviewName);
    });
}

export async function handleIntegrationShortcutKey(protocol: keyof ToWebviewProtocol, integrationName: string, sidebar: ContinueGUIWebviewViewProvider, webview: string) {
  const isOverlayVisible = await vscode.commands.executeCommand('pearai.isOverlayVisible');
  const currentTab = await sidebar.webviewProtocol.request("getCurrentTab", undefined, [webview]);

  if (isOverlayVisible && currentTab === integrationName) {
    // close overlay
    await vscode.commands.executeCommand("pearai.hideOverlay");
    return;
  }

  if (!isOverlayVisible) {
    // If overlay isn't open, open it first
    await vscode.commands.executeCommand("pearai.showOverlay");
  }

  // Navigate to creator tab via webview protocol
  await sidebar.webviewProtocol?.request(protocol, undefined, [webview]);
}

