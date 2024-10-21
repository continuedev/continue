import * as vscode from 'vscode';
import { Core } from 'core/core';
import { ContinueGUIWebviewViewProvider } from '../../ContinueGUIWebviewViewProvider';

let aiderPanel: vscode.WebviewPanel | undefined;

export function getAiderTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  console.log("All tabs:", tabs);
  return tabs.find((tab) => {
    const viewType = (tab.input as any)?.viewType;
    console.log("Tab view type:", viewType);
    return viewType?.endsWith("pearai.aiderGUIView");
  });
}

export function handleAiderMode(
  core: Core,
  sidebar: ContinueGUIWebviewViewProvider,
  extensionContext: vscode.ExtensionContext
) {
  // Check if aider is already open by checking open tabs
  const aiderTab = getAiderTab();
  core.invoke("llm/startAiderProcess", undefined);
  console.log("Aider tab found:", aiderTab);
  console.log("Aider tab active:", aiderTab?.isActive);
  console.log("Aider panel exists:", !!aiderPanel);

  // Check if the active editor is the Continue GUI View
  if (aiderTab && aiderTab.isActive) {
    vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
    return;
  }

  if (aiderTab && aiderPanel) {
    //aider open, but not focused - focus it
    aiderPanel.reveal();
    return;
  }

  //create the full screen panel
  let panel = vscode.window.createWebviewPanel(
    "pearai.aiderGUIView",
    "PearAI Creator (Powered by aider)",
    vscode.ViewColumn.One,
    {
      retainContextWhenHidden: true,
    },
  );
  aiderPanel = panel;

  //Add content to the panel
  panel.webview.html = sidebar.getSidebarContent(
    extensionContext,
    panel,
    undefined,
    undefined,
    true,
    "/aiderMode",
  );

  vscode.commands.executeCommand("pearai.focusContinueInput");

  //When panel closes, reset the webview and focus
  panel.onDidDispose(
    () => {
      // Kill background process
      core.invoke("llm/killAiderProcess", undefined);

      // The following order is important as it does not reset the history in chat when closing creator
      vscode.commands.executeCommand("pearai.focusContinueInput");
      sidebar.resetWebviewProtocolWebview();
    },
    null,
    extensionContext.subscriptions,
  );
}