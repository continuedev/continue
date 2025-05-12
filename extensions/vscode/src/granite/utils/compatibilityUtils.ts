import * as vscode from "vscode";

import type { VsCodeWebviewProtocol } from "../../webviewProtocol";

const incompatibleExtensionIds = new Set(["Continue.continue"]);
export function checkForIncompatibleExtensions(): boolean {
  const extensions = vscode.extensions.all;
  return extensions.some((e) => incompatibleExtensionIds.has(e.id));
}

export function setupExtensionCheck(
  context: vscode.ExtensionContext,
  webviewMessenger: VsCodeWebviewProtocol,
) {
  // Register a listener to check compatibility for every newly enabled extension
  const disposable = vscode.extensions.onDidChange(() => {
    webviewMessenger.send(
      "updateIncompatibleExtensions",
      checkForIncompatibleExtensions(),
    );
  });
  context.subscriptions.push(disposable);
}
