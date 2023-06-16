import * as vscode from "vscode";
import { registerAllCommands } from "../commands";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { sendTelemetryEvent, TelemetryEvent } from "../telemetry";
import { getExtensionUri } from "../util/vscode";
import * as path from "path";
// import { openCapturedTerminal } from "../terminal/terminalEmulator";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";
import { setupDebugPanel, ContinueGUIWebviewViewProvider } from "../debugPanel";
import { CapturedTerminal } from "../terminal/terminalEmulator";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;

export let ideProtocolClient: IdeProtocolClient;

export function activateExtension(
  context: vscode.ExtensionContext,
  showTutorial: boolean
) {
  sendTelemetryEvent(TelemetryEvent.ExtensionActivated);

  registerAllCodeLensProviders(context);
  registerAllCommands(context);

  // vscode.window.registerWebviewViewProvider("continue.continueGUIView", setupDebugPanel);

  let serverUrl = getContinueServerUrl();

  ideProtocolClient = new IdeProtocolClient(
    `${serverUrl.replace("http", "ws")}/ide/ws`,
    context
  );

  // Setup the left panel
  (async () => {
    const sessionId = await ideProtocolClient.getSessionId();
    const provider = new ContinueGUIWebviewViewProvider(sessionId);

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
  vscode.window.onDidOpenTerminal((terminal) => {
    if (terminal.name === "Continue") {
      return;
    }
    const options = terminal.creationOptions;
    const capturedTerminal = new CapturedTerminal({
      ...options,
      name: "Continue",
    });
    terminal.dispose();
    if (!ideProtocolClient.continueTerminal) {
      ideProtocolClient.continueTerminal = capturedTerminal;
    }
  });

  // If any terminals are open to start, replace them
  vscode.window.terminals.forEach((terminal) => {
    if (terminal.name === "Continue") {
      return;
    }
    const options = terminal.creationOptions;
    const capturedTerminal = new CapturedTerminal(
      {
        ...options,
        name: "Continue",
      },
      (commandOutput: string) => {
        ideProtocolClient.sendCommandOutput(commandOutput);
      }
    );
    terminal.dispose();
    if (!ideProtocolClient.continueTerminal) {
      ideProtocolClient.continueTerminal = capturedTerminal;
    }
  });

  extensionContext = context;
}
