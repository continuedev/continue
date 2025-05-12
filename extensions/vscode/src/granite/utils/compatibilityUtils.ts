import * as vscode from "vscode";

import { ExtensionConflictReport, ExtensionInfo } from "core";
import type { VsCodeWebviewProtocol } from "../../webviewProtocol";

const extensionNameLookup = new Map<string, string>([
  ["redhat.granitecode" /* no-transform */, "Granite.Code" /* no-transform */],
  ["Continue.continue" /* no-transform */, "Continue" /* no-transform */],
]);

// We have to omit this file while building, otherwise it would not work properly
const incompatibleExtensionIds = new Set(extensionNameLookup.keys());
let currentExtensionId = null;

export function checkForIncompatibleExtensions(): ExtensionConflictReport | null {
  const extensions = vscode.extensions.all;
  const conflictingExtensions: ExtensionInfo[] = extensions
    .filter((e) => incompatibleExtensionIds.has(e.id))
    .map((e) => {
      return {
        id: e.id,
        name: extensionNameLookup.get(e.id)!,
      };
    });

  if (conflictingExtensions.length === 0) {
    return null;
  } else {
    return {
      currentExtension: {
        id: currentExtensionId!,
        name: extensionNameLookup.get(currentExtensionId!)!,
      },
      conflictingExtensions,
    };
  }
}

export function setupExtensionCheck(
  context: vscode.ExtensionContext,
  webviewMessenger: VsCodeWebviewProtocol,
) {
  // Grab current extension id during activation
  currentExtensionId = context.extension.id;
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
