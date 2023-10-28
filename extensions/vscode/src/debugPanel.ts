import * as vscode from "vscode";
import { getContinueServerUrl } from "./bridge";
import {
  getExtensionUri,
  getNonce,
  getUniqueId,
  openEditorAndRevealRange,
} from "./util/vscode";
import { RangeInFile } from "../schema/RangeInFile";
import { setFocusedOnContinueInput } from "./commands";
import { windowId } from "./activation/activate";
import * as io from "socket.io-client";

let sockets: { [url: string]: io.Socket | undefined } = {};

export let debugPanelWebview: vscode.Webview | undefined;
export function setupDebugPanel(
  panel: vscode.WebviewPanel | vscode.WebviewView
): string {
  debugPanelWebview = panel.webview;
  panel.onDidDispose(() => {
    debugPanelWebview = undefined;
  });

  let extensionUri = getExtensionUri();
  let scriptUri: string;
  let styleMainUri: string;
  let vscMediaUrl: string = debugPanelWebview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui"))
    .toString();

  const isProduction = true; // context?.extensionMode === vscode.ExtensionMode.Development;
  if (isProduction) {
    scriptUri = debugPanelWebview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
      .toString();
    styleMainUri = debugPanelWebview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
      .toString();
  } else {
    scriptUri = "http://localhost:5173/src/main.tsx";
    styleMainUri = "http://localhost:5173/src/main.css";
  }

  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "gui")],
    enableCommandUris: true,
  };

  const nonce = getNonce();

  vscode.window.onDidChangeTextEditorSelection((e) => {
    if (e.selections[0].isEmpty) {
      return;
    }

    const rangeInFile: RangeInFile = {
      range: e.selections[0] as any,
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
        sockets[url] = undefined;
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
        const socket = io.io(getContinueServerUrl(), {
          path: "/gui/socket.io",
          transports: ["websocket", "polling", "flashsocket"],
        });
        sockets[url] = socket;
        resolve(null);
      } catch (e) {
        console.log("Failed to connect to GUI websocket for forwarding", e);
        reject(e);
      }
    });
  }

  panel.webview.onDidReceiveMessage(async (data) => {
    switch (data.type) {
      case "onLoad": {
        panel.webview.postMessage({
          type: "onLoad",
          vscMachineId: getUniqueId(),
          apiUrl: getContinueServerUrl(),
          workspacePaths: vscode.workspace.workspaceFolders?.map(
            (folder) => folder.uri.fsPath
          ),
          vscMediaUrl,
          dataSwitchOn: vscode.workspace
            .getConfiguration("continue")
            .get<boolean>("dataSwitch"),
        });
        break;
      }
      case "websocketForwardingOpen": {
        let url = data.url;
        if (typeof sockets[url] === "undefined") {
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
      case "websocketForwardingClose": {
        let url = data.url;
        let socket = sockets[url];
        if (typeof socket !== "undefined") {
          socket.close();
          sockets[url] = undefined;
        }
        break;
      }
      case "websocketForwardingMessage": {
        let url = data.url;
        let socket = sockets[url];
        if (typeof socket === "undefined") {
          await connectWebsocket(url);
        }
        socket = sockets[url];
        if (typeof socket === "undefined") {
          throw new Error("Failed to connect socket for forwarding");
        }
        socket.send(data.message);
        break;
      }
      case "openFile": {
        openEditorAndRevealRange(data.path, undefined, vscode.ViewColumn.One);
        break;
      }
      case "toggleDevTools": {
        vscode.commands.executeCommand("workbench.action.toggleDevTools");
        vscode.commands.executeCommand("continue.viewLogs");
        break;
      }
      case "reloadWindow": {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
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

        <script>localStorage.setItem("ide", "vscode")</script>
        <script>window.windowId = "${windowId}"</script>
      </body>
    </html>`;
}

export class ContinueGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "continue.continueGUIView";

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewView.webview.html = setupDebugPanel(webviewView);
  }
}
