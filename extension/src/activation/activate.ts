import * as vscode from "vscode";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
import {
  getExtensionVersion,
  startContinuePythonServer,
} from "./environmentSetup";
import fetch from "node-fetch";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { registerAllCommands } from "../commands";
import registerQuickFixProvider from "../lang-server/codeActions";

const PACKAGE_JSON_RAW_GITHUB_URL =
  "https://raw.githubusercontent.com/continuedev/continue/HEAD/extension/package.json";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;

export let ideProtocolClient: IdeProtocolClient;

function getExtensionVersionInt(versionString: string): number {
  return parseInt(versionString.replace(/\./g, ""));
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

  // Register commands and providers
  registerAllCodeLensProviders(context);
  registerAllCommands(context);
  registerQuickFixProvider();

  // Start the server
  const sessionIdPromise = (async () => {
    await startContinuePythonServer();

    console.log("Continue server started");
    // Initialize IDE Protocol Client
    const serverUrl = getContinueServerUrl();
    ideProtocolClient = new IdeProtocolClient(
      `${serverUrl.replace("http", "ws")}/ide/ws`,
      context
    );
    return await ideProtocolClient.getSessionId();
  })();

  // Register Continue GUI as sidebar webview, and beginning a new session
  const provider = new ContinueGUIWebviewViewProvider(sessionIdPromise);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "continue.continueGUIView",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  // vscode.commands.executeCommand("continue.focusContinueInput");
}
