/**
 * This is the entry point for the extension.
 */

import * as vscode from "vscode";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  const { activateExtension } = await import("./activation/activate");
  try {
    await activateExtension(context);
  } catch (e) {
    console.log("Error activating extension: ", e);
    vscode.window.showInformationMessage(
      "Error activating the Continue extension."
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  dynamicImportAndActivate(context);
}
