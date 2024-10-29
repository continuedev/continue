import { getContinueRcPath, getTsConfigPath, migrate } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import path from "node:path";
import * as vscode from "vscode";
import { VsCodeExtension } from "../extension/VsCodeExtension";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionVersion } from "../util/util";
import { getExtensionUri } from "../util/vscode";
import { VsCodeContinueApi } from "./api";
import { setupInlineTips } from "./inlineTips";
import { isFirstLaunch, importUserSettingsFromVSCode } from "../copySettings";

export async function activateExtension(context: vscode.ExtensionContext) {
  // Add necessary files
  getTsConfigPath();
  getContinueRcPath();

  // Register commands and providers
  registerQuickFixProvider();
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  setupPearAppLayout();

  migrate("showWelcome_1", () => {
    vscode.commands.executeCommand(
      "markdown.showPreview",
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "media", "welcome.md"),
      ),
    );

    vscode.commands.executeCommand("pearai.focusContinueInput");
  });

  vscode.commands.executeCommand("pearai.focusContinueInput");
  importUserSettingsFromVSCode();

  // Load PearAI configuration
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

// Custom Layout settings that we want default for PearAPP
const setupPearAppLayout = () => {
  // * always * move pearai extension to auxiliary bar (secondary side bar)
  vscode.commands.executeCommand("workbench.action.movePearExtensionToAuxBar");

  // set activity bar position to top
  vscode.commands.executeCommand("workbench.action.activityBarLocation.top");

  // Apply the remaining layout settings only on the first launch
  if (isFirstLaunch) {
    return;
  }

  // first launch layout settings here.
};
