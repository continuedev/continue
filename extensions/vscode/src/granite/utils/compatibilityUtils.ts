import { ExtensionConflictReport, ExtensionInfo } from "core";
import * as vscode from "vscode";

import type { VsCodeWebviewProtocol } from "../../webviewProtocol";

const incompatibleExtensionIds = new Set<string>([
  "redhat.granitecode" /* no-transform */,
  "Continue.continue" /* no-transform */,
]);

let currentExtension: ExtensionInfo | undefined;

export function checkForIncompatibleExtensions(): ExtensionConflictReport | null {
  const extensions = vscode.extensions.all;
  const conflictingExtensions: ExtensionInfo[] = extensions
    .filter((e) => incompatibleExtensionIds.has(e.id))
    .map((e) => {
      return {
        id: e.id,
        name: e.packageJSON.displayName ?? e.packageJSON.name,
      };
    });

  return conflictingExtensions.length === 0
    ? null
    : {
        currentExtension: currentExtension!,
        conflictingExtensions,
      };
}

export function setupExtensionCheck(
  context: vscode.ExtensionContext,
  webviewMessenger: VsCodeWebviewProtocol,
) {
  // Grab current extension id during activation
  const currentExtensionId = context.extension.id;
  currentExtension = {
    id: currentExtensionId,
    name:
      context.extension.packageJSON.displayName ??
      context.extension.packageJSON.name,
  };
  // Remove current extension id from the incompatible list
  incompatibleExtensionIds.delete(currentExtensionId);

  // Register a listener to check compatibility for every newly enabled extension
  const disposable = vscode.extensions.onDidChange(() => {
    webviewMessenger.send(
      "updateIncompatibleExtensions",
      checkForIncompatibleExtensions(),
    );
  });
  context.subscriptions.push(disposable);
}

/**
 * Move Granite.Code into the default view container of Copilot, and move Copilot to our spare view container
 */
export function replaceCopilotWithGraniteCode() {
  // Move Copilot to the spare activity sidebar container we created
  vscode.commands
    .executeCommand("vscode.moveViews", {
      viewIds: ["workbench.panel.chat.view.copilot"],
      destinationId: "workbench.view.extension.graniteMoveChatDestination",
    })
    .then(() => {
      // Move Granite.Code to Copilot's default container
      vscode.commands.executeCommand("vscode.moveViews", {
        viewIds: ["continue.continueGUIView"],
        destinationId: "workbench.panel.chat",
      });
    });
}
