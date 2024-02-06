/**
 * This is the entry point for the extension.
 * 
 * 2024-02 Modified by Lukas Prediger, Copyright (c) 2023 CSC - IT Center for Science Ltd.
 */

import * as vscode from "vscode";
import { getExtensionVersion } from "./util/util";
import { getUniqueId } from "./util/vscode";

let client: any = undefined;
export async function capture(args: any) {
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
    const ownApi = await activateExtension(context);
    return ownApi;
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
  return dynamicImportAndActivate(context);
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
