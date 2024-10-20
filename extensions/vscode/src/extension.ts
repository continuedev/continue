/**
 * This is the entry point for the extension.
 *
 * Note: This file has been significantly modified from its original contents. pearai-submodule is a fork of Continue (https://github.com/continuedev/continue).
 */

import { setupCa } from "core/util/ca";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";
import { getExtensionVersion } from "./util/util";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  const { activateExtension } = await import("./activation/activate");
  try {
    return activateExtension(context);
  } catch (e) {
    console.log("Error activating extension: ", e);
    vscode.window
      .showInformationMessage(
        "Error activating the PearAI extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("pearai.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  }
}

export function activate(context: vscode.ExtensionContext) {
  setupCa();
  dynamicImportAndActivate(context);
}

export function deactivate() {
  Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();
}
