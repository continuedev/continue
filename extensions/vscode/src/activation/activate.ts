import { getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import path from "path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/vscodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { showTutorial } from "../webviewProtocol";
import { setupInlineTips } from "./inlineTips";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  showTutorial();
  vscode.commands.executeCommand(
    "markdown.showPreview",
    vscode.Uri.file(path.join(getExtensionUri().fsPath, "media", "welcome.md")),
  );
  migrate("showWelcome_1", () => {});

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    Telemetry.capture("install", {
      extensionVersion: getExtensionVersion(),
    });
  }
}
