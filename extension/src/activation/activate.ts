import * as vscode from "vscode";
import { registerAllCommands } from "../commands";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
import {
  getExtensionVersion,
  startContinuePythonServer,
} from "./environmentSetup";
import fetch from "node-fetch";
import registerQuickFixProvider from "../lang-server/codeActions";
import { get } from "http";
// import { CapturedTerminal } from "../terminal/terminalEmulator";

const PACKAGE_JSON_RAW_GITHUB_URL =
  "https://raw.githubusercontent.com/continuedev/continue/HEAD/extension/package.json";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;

export let ideProtocolClient: IdeProtocolClient;

export async function activateExtension(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Before anything else, check whether this is an out-of-date version of the extension
  // Do so by grabbing the package.json off of the GitHub respository for now.
  fetch(PACKAGE_JSON_RAW_GITHUB_URL)
    .then(async (res) => res.json())
    .then((packageJson) => {
      if (packageJson.version !== getExtensionVersion()) {
        vscode.window.showInformationMessage(
          `You are using an out-of-date version of the Continue extension. Please update to the latest version.`
        );
      }
    })
    .catch((e) => console.log("Error checking for extension updates: ", e));

  // Start the server and display loader if taking > 2 seconds
  const sessionIdPromise = (async () => {
    await new Promise((resolve) => {
      let serverStarted = false;

      // Start the server and set serverStarted to true when done
      startContinuePythonServer().then(() => {
        serverStarted = true;
        resolve(null);
      });

      // Wait for 2 seconds
      setTimeout(() => {
        // If the server hasn't started after 2 seconds, show the notification
        if (!serverStarted) {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title:
                "Starting Continue Server... (it may take a minute to download Python packages)",
              cancellable: false,
            },
            async (progress, token) => {
              // Wait for the server to start
              while (!serverStarted) {
                await new Promise((innerResolve) =>
                  setTimeout(innerResolve, 1000)
                );
              }
              return Promise.resolve();
            }
          );
        }
      }, 2000);
    });

    // Initialize IDE Protocol Client
    const serverUrl = getContinueServerUrl();
    ideProtocolClient = new IdeProtocolClient(
      `${serverUrl.replace("http", "ws")}/ide/ws`,
      context
    );
    return await ideProtocolClient.getSessionId();
  })();

  // Register Continue GUI as sidebar webview, and beging a new session
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
}
