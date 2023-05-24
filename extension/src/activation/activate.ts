import * as vscode from "vscode";
import { registerAllCommands } from "../commands";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { sendTelemetryEvent, TelemetryEvent } from "../telemetry";
import { getExtensionUri } from "../util/vscode";
import * as path from "path";
// import { openCapturedTerminal } from "../terminal/terminalEmulator";
import IdeProtocolClient from "../continueIdeClient";
import { getContinueServerUrl } from "../bridge";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;

export let ideProtocolClient: IdeProtocolClient | undefined = undefined;

export function activateExtension(
  context: vscode.ExtensionContext,
  showTutorial: boolean
) {
  sendTelemetryEvent(TelemetryEvent.ExtensionActivated);

  registerAllCodeLensProviders(context);
  registerAllCommands(context);

  let serverUrl = getContinueServerUrl();

  ideProtocolClient = new IdeProtocolClient(
    serverUrl.replace("http", "ws") + "/ide/ws",
    context
  );

  if (showTutorial && false) {
    Promise.all([
      vscode.workspace
        .openTextDocument(
          path.join(getExtensionUri().fsPath, "examples/python/sum.py")
        )
        .then((document) =>
          vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
          })
        ),

      vscode.workspace
        .openTextDocument(
          path.join(getExtensionUri().fsPath, "examples/python/main.py")
        )
        .then((document) =>
          vscode.window
            .showTextDocument(document, {
              preview: false,
              viewColumn: vscode.ViewColumn.One,
            })
            .then((editor) => {
              editor.revealRange(
                new vscode.Range(0, 0, 0, 0),
                vscode.TextEditorRevealType.InCenter
              );
            })
        ),
    ]).then(() => {
      ideProtocolClient?.openNotebook();
    });
  } else {
    // ideProtocolClient?.openNotebook().then(() => {
    //   // openCapturedTerminal();
    // });
  }

  extensionContext = context;
}
