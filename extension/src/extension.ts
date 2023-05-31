/**
 * This is the entry point for the extension.
 */

import * as vscode from "vscode";
import {
  isPythonEnvSetup,
  startContinuePythonServer,
} from "./activation/environmentSetup";

async function dynamicImportAndActivate(
  context: vscode.ExtensionContext,
  showTutorial: boolean
) {
  const { activateExtension } = await import("./activation/activate");
  activateExtension(context, showTutorial);
}

export function activate(context: vscode.ExtensionContext) {
  // Only show progress if we have to setup
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Setting up Continue extension...",
      cancellable: false,
    },
    async () => {
      await startContinuePythonServer();
      dynamicImportAndActivate(context, true);
    }
  );
}
