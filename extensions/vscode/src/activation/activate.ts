import * as vscode from "vscode";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import {
  ContinueGUIWebviewViewProvider,
  getSidebarContent,
} from "../debugPanel";
import {
  getExtensionVersion,
  startContinuePythonServer,
} from "./environmentSetup";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { registerAllCommands } from "../commands";
import registerQuickFixProvider from "../lang-server/codeActions";
import { getExtensionUri } from "../util/vscode";
import path from "path";
import { setupInlineTips } from "./inlineTips";
import { v4 } from "uuid";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;
export let ideProtocolClient: IdeProtocolClient;
export let windowId: string = v4();

function addPythonPathForConfig() {
  // Add to python.analysis.extraPaths global setting so config.py gets LSP

  if (
    vscode.workspace.workspaceFolders?.some((folder) =>
      folder.uri.fsPath.endsWith("continue")
    )
  ) {
    // Not for the Continue repo
    return;
  }

  const pythonConfig = vscode.workspace.getConfiguration("python");
  const analysisPaths = pythonConfig.get<string[]>("analysis.extraPaths");
  const autoCompletePaths = pythonConfig.get<string[]>(
    "autoComplete.extraPaths"
  );
  const pathToAdd = extensionContext?.extensionPath;
  if (analysisPaths && pathToAdd && !analysisPaths.includes(pathToAdd)) {
    analysisPaths.push(pathToAdd);
    pythonConfig.update(
      "analysis.extraPaths",
      analysisPaths,
      vscode.ConfigurationTarget.Global
    );
  }

  if (
    autoCompletePaths &&
    pathToAdd &&
    !autoCompletePaths.includes(pathToAdd)
  ) {
    autoCompletePaths.push(pathToAdd);
    pythonConfig.update(
      "autoComplete.extraPaths",
      autoCompletePaths,
      vscode.ConfigurationTarget.Global
    );
  }
}

async function openTutorial(context: vscode.ExtensionContext) {
  if (context.globalState.get<boolean>("continue.tutorialShown") !== true) {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(
        path.join(getExtensionUri().fsPath, "continue_tutorial.py")
      )
    );
    await vscode.window.showTextDocument(doc);
    context.globalState.update("continue.tutorialShown", true);
  }
}

function showRefactorMigrationMessage() {
  // Only if the vscode setting continue.manuallyRunningSserver is true
  const manuallyRunningServer =
    vscode.workspace
      .getConfiguration("continue")
      .get<boolean>("manuallyRunningServer") || false;
  if (
    manuallyRunningServer &&
    extensionContext?.globalState.get<boolean>(
      "continue.showRefactorMigrationMessage"
    ) !== false
  ) {
    vscode.window
      .showInformationMessage(
        "The Continue server protocol was recently updated in a way that requires the latest server version to work properly. Since you are manually running the server, please be sure to upgrade with `pip install --upgrade continuedev`.",
        "Got it",
        "Don't show again"
      )
      .then((selection) => {
        if (selection === "Don't show again") {
          // Get the global state
          extensionContext?.globalState.update(
            "continue.showRefactorMigrationMessage",
            false
          );
        }
      });
  }
}

export async function activateExtension(context: vscode.ExtensionContext) {
  extensionContext = context;

  console.log("Using Continue version: ", getExtensionVersion());
  try {
    console.log(
      "In workspace: ",
      vscode.workspace.workspaceFolders?.[0].uri.fsPath
    );
  } catch (e) {
    console.log("Error getting workspace folder: ", e);
  }
  console.log("Window ID: ", windowId);

  // Register commands and providers
  registerAllCodeLensProviders(context);
  registerAllCommands(context);
  registerQuickFixProvider();
  addPythonPathForConfig();
  await openTutorial(context);
  setupInlineTips(context);
  showRefactorMigrationMessage();

  (async () => {
    // Start the server
    await startContinuePythonServer();
    console.log("Continue server started");

    // Initialize IDE Protocol Client
    const serverUrl = getContinueServerUrl();
    ideProtocolClient = new IdeProtocolClient(serverUrl, context);
  })();

  // Register Continue GUI as sidebar webview, and beginning a new session
  const provider = new ContinueGUIWebviewViewProvider();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "continue.continueGUIView",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );
}
