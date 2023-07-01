import * as vscode from "vscode";
import { registerAllCommands } from "../commands";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { sendTelemetryEvent, TelemetryEvent } from "../telemetry";
// import { openCapturedTerminal } from "../terminal/terminalEmulator";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import { CapturedTerminal } from "../terminal/terminalEmulator";
import { setupDebugPanel, ContinueGUIWebviewViewProvider } from "../debugPanel";
import { startContinuePythonServer } from "./environmentSetup";
// import { CapturedTerminal } from "../terminal/terminalEmulator";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;

export let ideProtocolClient: IdeProtocolClient;

export async function activateExtension(
  context: vscode.ExtensionContext,
  showTutorial: boolean
) {
  extensionContext = context;

  await new Promise((resolve, reject) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title:
          "Starting Continue Server... (it may take a minute to download Python packages)",
        cancellable: false,
      },
      async (progress, token) => {
        await startContinuePythonServer();
        resolve(null);
      }
    );
  });

  sendTelemetryEvent(TelemetryEvent.ExtensionActivated);
  registerAllCodeLensProviders(context);
  registerAllCommands(context);

  const serverUrl = getContinueServerUrl();

  ideProtocolClient = new IdeProtocolClient(
    `${serverUrl.replace("http", "ws")}/ide/ws`,
    context
  );

  // Setup the left panel
  (async () => {
    const sessionIdPromise = await ideProtocolClient.getSessionId();
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
  })();
  // All opened terminals should be replaced by our own terminal
  // vscode.window.onDidOpenTerminal((terminal) => {});

  // If any terminals are open to start, replace them
  // vscode.window.terminals.forEach((terminal) => {}
}
