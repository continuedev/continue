/**
 * This is the entry point for the extension.
 */

import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";
import { IVsCodeExtensionAPI } from "./extension/api";
import { getExtensionVersion } from "./util/util";

async function dynamicImportAndActivate(context: vscode.ExtensionContext): Promise<IVsCodeExtensionAPI | null> {
  const { activateExtension } = await import("./activation/activate");
  try {
    const instance = await activateExtension(context);
    return { instance };
  } catch (e) {
    console.log("Error activating extension: ", e);
    vscode.window
      .showInformationMessage(
        "Error activating the Continue extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("continue.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
    return null;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<IVsCodeExtensionAPI | null> {
  return dynamicImportAndActivate(context);
}

export function deactivate() {
  Telemetry.capture("deactivate", {
    extensionVersion: getExtensionVersion(),
  });

  Telemetry.shutdownPosthogClient();
}
