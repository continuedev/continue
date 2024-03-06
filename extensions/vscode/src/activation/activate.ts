import { getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import * as fs from "fs";
import path from "path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/vscodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { setupInlineTips } from "./inlineTips";

export async function showTutorial() {
  const tutorialPath = path.join(
    getExtensionUri().fsPath,
    "continue_tutorial.py",
  );
  // Ensure keyboard shortcuts match OS
  if (process.platform !== "darwin") {
    let tutorialContent = fs.readFileSync(tutorialPath, "utf8");
    tutorialContent = tutorialContent.replace("⌘", "^");
    fs.writeFileSync(tutorialPath, tutorialContent);
  }

  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(tutorialPath),
  );
  await vscode.window.showTextDocument(doc);
}

async function openTutorialFirstTime(context: vscode.ExtensionContext) {
  if (context.globalState.get<boolean>("continue.tutorialShown") !== true) {
    await showTutorial();
    context.globalState.update("continue.tutorialShown", true);
  }
}

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
  await openTutorialFirstTime(context);
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
