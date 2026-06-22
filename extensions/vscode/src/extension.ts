/**
 * This is the entry point for the extension.
 */

import { setupCa } from "core/util/ca";
<<<<<<< HEAD
import { extractMinimalStackTraceInfo } from "core/util/extractMinimalStackTraceInfo";
import { Telemetry } from "core/util/posthog";
import * as vscode from "vscode";

import { SentryLogger } from "core/util/sentry/SentryLogger";
import { getExtensionVersion } from "./util/util";
=======
import * as vscode from "vscode";

>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
export { default as buildTimestamp } from "./.buildTimestamp";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");
  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  return dynamicImportAndActivate(context).catch((e) => {
    console.log("Error activating extension: ", e);
<<<<<<< HEAD
    Telemetry.capture(
      "vscode_extension_activation_error",
      {
        stack: extractMinimalStackTraceInfo(e.stack),
        message: e.message,
      },
      false,
      true,
    );
=======
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
    vscode.window
      .showWarningMessage(
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
  });
}

<<<<<<< HEAD
export function deactivate() {
  void Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();
  SentryLogger.shutdownSentryClient();
}
=======
export function deactivate() {}
>>>>>>> 18acf6fc2 (test(cli): isolate GlobalContext to fix flaky model-persistence tests (#12639))
