/**
 * This is the entry point for the extension.
 */

import { getExtensionVersion } from "core/util/environmentSetup";
import * as vscode from "vscode";
import { getUniqueId } from "./util/vscode";

let client: any = undefined;
export async function capture(args: any) {
  console.log("Capturing posthog event: ", args);
  if (!client) {
    const { PostHog } = await import("posthog-node");
    client = new PostHog("phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs", {
      host: "https://app.posthog.com",
    });
  }
  client.capture(args);
}

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    capture({
      distinctId: getUniqueId(),
      event: "install",
      properties: {
        extensionVersion: getExtensionVersion(),
      },
    });
  }

  const { activateExtension } = await import("./activation/activate");
  try {
    await activateExtension(context);
  } catch (e) {
    console.log("Error activating extension: ", e);
    vscode.window
      .showInformationMessage(
        "Error activating the Continue extension.",
        "View Logs",
        "Retry"
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("continue.viewLogs");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  }
}

export function activate(context: vscode.ExtensionContext) {
  dynamicImportAndActivate(context);
}

export function deactivate() {
  capture({
    distinctId: getUniqueId(),
    event: "deactivate",
    properties: {
      extensionVersion: getExtensionVersion(),
    },
  });

  client?.shutdown();
}
