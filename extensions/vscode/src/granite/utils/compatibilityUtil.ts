import * as vscode from "vscode";

import type { VsCodeWebviewProtocol } from "../../webviewProtocol";

const incompatibleExtensionIds = new Set(["Continue.continue"]);
function checkForIncompatibleExtensions(): boolean {
  const extensions = vscode.extensions.all;
  return extensions.some((e) => incompatibleExtensionIds.has(e.id));
}

export function setupExtensionCheck(webviewMessenger: VsCodeWebviewProtocol) {
  // Check if incompatible extensions exist when Granite.Code is activated
  // Keep sending the checking result until the response is received
  const intervalId = setInterval(async () => {
    const doRespond = await Promise.race([
      webviewMessenger.request(
        "checkForIncompatibleExtensions",
        checkForIncompatibleExtensions(),
      ),
      new Promise((resolve) =>
        setTimeout(() => {
          resolve(false);
        }, 900),
      ),
    ]);
    if (doRespond) {
      clearInterval(intervalId);
    }
  }, 1000);

  // Resgister a listener to check compatibility for every newly enabled extension
  vscode.extensions.onDidChange(() => {
    webviewMessenger.send(
      "checkForIncompatibleExtensions",
      checkForIncompatibleExtensions(),
    );
  });
}
