import * as vscode from "vscode";
import { getContinueServerUrl } from "./bridge";
import {
  getExtensionUri,
  getNonce,
  openEditorAndRevealRange,
} from "./util/vscode";
import { RangeInFile } from "./client";
import { setFocusedOnContinueInput } from "./commands";
const WebSocket = require("ws");

let websocketConnections: { [url: string]: WebsocketConnection | undefined } =
  {};

class WebsocketConnection {
  private _ws: WebSocket;
  private _onMessage: (message: string) => void;
  private _onOpen: () => void;
  private _onClose: () => void;
  private _onError: (e: any) => void;

  constructor(
    url: string,
    onMessage: (message: string) => void,
    onOpen: () => void,
    onClose: () => void,
    onError: (e: any) => void
  ) {
    this._ws = new WebSocket(url);
    this._onMessage = onMessage;
    this._onOpen = onOpen;
    this._onClose = onClose;
    this._onError = onError;

    this._ws.addEventListener("message", (event) => {
      this._onMessage(event.data);
    });
    this._ws.addEventListener("close", () => {
      this._onClose();
    });
    this._ws.addEventListener("open", () => {
      this._onOpen();
    });
    this._ws.addEventListener("error", (e: any) => {
      this._onError(e);
    });
  }

  public send(message: string) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(message);
    } else {
      this._ws.addEventListener("open", () => {
        this._ws.send(message);
      });
    }
  }

  public close() {
    this._ws.close();
  }
}

export let debugPanelWebview: vscode.Webview | undefined;
export function setupDebugPanel(
  panel: vscode.WebviewPanel | vscode.WebviewView,
  sessionIdPromise: Promise<string> | string
): string {
  debugPanelWebview = panel.webview;
  panel.onDidDispose(() => {
    debugPanelWebview = undefined;
  });

  let extensionUri = getExtensionUri();
  let scriptUri: string;
  let styleMainUri: string;
  let vscMediaUrl: string = debugPanelWebview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "react-app/dist"))
    .toString();

  const isProduction = true; // context?.extensionMode === vscode.ExtensionMode.Development;
  if (isProduction) {
    scriptUri = debugPanelWebview
      .asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "react-app/dist/assets/index.js")
      )
      .toString();
    styleMainUri = debugPanelWebview
      .asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "react-app/dist/assets/index.css")
      )
      .toString();
  } else {
    scriptUri = "http://localhost:5173/src/main.tsx";
    styleMainUri = "http://localhost:5173/src/main.css";
  }

  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "react-app/dist")],
    enableCommandUris: true,
  };

  const nonce = getNonce();

  vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.selections[0].isEmpty) {
      return;
    }

    const rangeInFile: RangeInFile = {
      range: e.selections[0],
      filepath: e.textEditor.document.fileName,
    };
    const filesystem = {
      [rangeInFile.filepath]: e.textEditor.document.getText(),
    };
    panel.webview.postMessage({
      type: "highlightedCode",
      rangeInFile,
      filesystem,
    });

    panel.webview.postMessage({
      type: "workspacePath",
      value: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
    });
  });

  async function connectWebsocket(url: string) {
    return new Promise((resolve, reject) => {
      const onMessage = (message: any) => {
        panel.webview.postMessage({
          type: "websocketForwardingMessage",
          url,
          data: message,
        });
      };
      const onOpen = () => {
        panel.webview.postMessage({
          type: "websocketForwardingOpen",
          url,
        });
        resolve(null);
      };
      const onClose = () => {
        websocketConnections[url] = undefined;
        panel.webview.postMessage({
          type: "websocketForwardingClose",
          url,
        });
      };
      const onError = (e: any) => {
        panel.webview.postMessage({
          type: "websocketForwardingError",
          url,
          error: e,
        });
      };
      try {
        const connection = new WebsocketConnection(
          url,
          onMessage,
          onOpen,
          onClose,
          onError
        );
        websocketConnections[url] = connection;
        resolve(null);
      } catch (e) {
        console.log("Caught it!: ", e);
        reject(e);
      }
    });
  }

  panel.webview.onDidReceiveMessage(async (data) => {
    switch (data.type) {
      case "onLoad": {
        let sessionId: string;
        console.log("Waiting for session id");
        if (typeof sessionIdPromise === "string") {
          sessionId = sessionIdPromise;
        } else {
          sessionId = await sessionIdPromise;
        }
        console.log("Done with onLoad: ", sessionId);
        panel.webview.postMessage({
          type: "onLoad",
          vscMachineId: vscode.env.machineId,
          apiUrl: getContinueServerUrl(),
          sessionId,
          vscMediaUrl,
          dataSwitchOn: vscode.workspace
            .getConfiguration("continue")
            .get<boolean>("dataSwitch"),
        });
        break;
      }
      case "toggleDataSwitch": {
        // Set the setting in vscode
        await vscode.workspace
          .getConfiguration("continue")
          .update("dataSwitch", data.on, vscode.ConfigurationTarget.Global);
        break;
      }
      case "websocketForwardingOpen": {
        let url = data.url;
        if (typeof websocketConnections[url] === "undefined") {
          await connectWebsocket(url);
        } else {
          console.log(
            "Websocket connection requested by GUI already open at",
            url
          );
          panel.webview.postMessage({
            type: "websocketForwardingOpen",
            url,
          });
        }
        break;
      }
      case "websocketForwardingMessage": {
        let url = data.url;
        let connection = websocketConnections[url];
        if (typeof connection === "undefined") {
          await connectWebsocket(url);
        }
        connection = websocketConnections[url];
        if (typeof connection === "undefined") {
          throw new Error("Failed to connect websocket in VS Code Extension");
        }
        connection.send(data.message);
        break;
      }
      case "openFile": {
        openEditorAndRevealRange(data.path, undefined, vscode.ViewColumn.One);
        break;
      }
      case "blurContinueInput": {
        setFocusedOnContinueInput(false);
        break;
      }
      case "focusEditor": {
        setFocusedOnContinueInput(false);
        vscode.commands.executeCommand(
          "workbench.action.focusActiveEditorGroup"
        );
        break;
      }
      case "withProgress": {
        // This message allows withProgress to be used in the webview
        if (data.done) {
          // Will be caught in the listener created below
          break;
        }
        let title = data.title;
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title,
            cancellable: false,
          },
          async () => {
            return new Promise<void>((resolve, reject) => {
              let listener = panel.webview.onDidReceiveMessage(async (data) => {
                if (
                  data.type === "withProgress" &&
                  data.done &&
                  data.title === title
                ) {
                  listener.dispose();
                  resolve();
                }
              });
            });
          }
        );

        break;
      }
    }
  });

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>const vscode = acquireVsCodeApi();</script>
        <link href="${styleMainUri}" rel="stylesheet">

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
        
        <title>Continue</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;
}

export class ContinueGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "continue.continueGUIView";
  private readonly sessionIdPromise: Promise<string> | string;

  constructor(sessionIdPromise: Promise<string> | string) {
    this.sessionIdPromise = sessionIdPromise;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewView.webview.html = setupDebugPanel(
      webviewView,
      this.sessionIdPromise
    );
  }
}
