import { getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import path from "node:path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { WorkOsAuthProvider } from "../stubs/WorkOsAuthProvider";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { VsCodeContinueApi } from "./api";
import { setupInlineTips } from "./inlineTips";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);

  // Register auth provider
  const workOsAuthProvider = new WorkOsAuthProvider(context);
  await workOsAuthProvider.initialize();
  context.subscriptions.push(workOsAuthProvider);

  const vscodeExtension = new VsCodeExtension(context);

  migrate("showWelcome_1", () => {
    vscode.commands.executeCommand(
      "markdown.showPreview",
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "media", "welcome.md"),
      ),
    );

    vscode.commands.executeCommand("continue.focusContinueInput");
  });

  // Load Continue configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    context.globalState.update("hasBeenInstalled", true);
    Telemetry.capture(
      "install",
      {
        extensionVersion: getExtensionVersion(),
      },
      true,
    );
  }

  const api = new VsCodeContinueApi(vscodeExtension);
  const continuePublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  // 'export' public api-surface
  // or entire extension for testing
  return process.env.NODE_ENV === "test"
    ? {
        ...continuePublicApi,
        extension: vscodeExtension,
      }
    : continuePublicApi;
}
