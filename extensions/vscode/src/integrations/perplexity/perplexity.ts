import * as vscode from "vscode";
import { ContinueGUIWebviewViewProvider } from "../../ContinueGUIWebviewViewProvider";
import { getIntegrationTab } from "../../util/integrationUtils";

let perplexityPanel: vscode.WebviewPanel | undefined;
const webviewName = "pearai.perplexityGUIView";

export async function handlePerplexityMode(
  sidebar: ContinueGUIWebviewViewProvider,
  extensionContext: vscode.ExtensionContext,
) {
  const perplexityTab = getIntegrationTab(webviewName);

  // Check if the active editor is the Continue GUI View
  if (perplexityTab && perplexityTab.isActive) {
    vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
    return;
  }

  if (perplexityTab && perplexityPanel) {
    perplexityPanel.reveal();
    return;
  }

  //create the full screen panel
  let panel = vscode.window.createWebviewPanel(
    webviewName,
    "PearAI Search (Powered by Perplexity)",
    vscode.ViewColumn.One,
    {
      retainContextWhenHidden: true,
    },
  );
  perplexityPanel = panel;

  //Add content to the panel
  panel.webview.html = sidebar.getSidebarContent(
    extensionContext,
    panel,
    undefined,
    undefined,
    true,
    "/perplexityMode",
  );

  sidebar.webviewProtocol?.request("focusContinueInputWithNewSession", undefined, [webviewName]);

  //When panel closes, reset the webview and focus
  panel.onDidDispose(
    () => {
      // The following order is important as it does not reset the history in chat when closing creator
      vscode.commands.executeCommand("pearai.focusContinueInput");
      sidebar.resetWebviewProtocolWebview();
    },
    null,
    extensionContext.subscriptions,
  );
}
