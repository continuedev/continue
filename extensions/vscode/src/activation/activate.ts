import * as vscode from "vscode";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
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
import { uuid } from "uuidv4";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;
export let ideProtocolClient: IdeProtocolClient;
export let windowId: string = uuid();

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
