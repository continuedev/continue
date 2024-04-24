import { getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import path from "path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/vscodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { setupInlineTips } from "./inlineTips";

function showRefactorMigrationMessage(
  extensionContext: vscode.ExtensionContext,
) {
  // Only if the vscode setting continue.manuallyRunningSserver is true
  const manuallyRunningServer =
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("manuallyRunningServer") || false;
  if (
    manuallyRunningServer &&
    extensionContext?.globalState.get<boolean>(
      "continue.showRefactorMigrationMessage",
    ) !== false
  ) {
    vscode.window
      .showInformationMessage(
        "The Continue server protocol was recently updated in a way that requires the latest server version to work properly. Since you are manually running the server, please be sure to upgrade with `pip install --upgrade continuedev`.",
        "Got it",
        "Don't show again",
      )
      .then((selection) => {
        if (selection === "Don't show again") {
          // Get the global state
          extensionContext?.globalState.update(
            "continue.showRefactorMigrationMessage",
            false,
          );
        }
      });
  }
}

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);
  showRefactorMigrationMessage(context);

  const vscodeExtension = new VsCodeExtension(context);

  migrate("showWelcome_1", () => {
    vscode.commands.executeCommand(
      "markdown.showPreview",
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "media", "welcome.md"),
      ),
    );
  });

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    Telemetry.capture("install", {
      extensionVersion: getExtensionVersion(),
    });
  }
}
