import { FileEdit, IDE } from "core";
import { ConfigHandler } from "core/config/handler";
import * as vscode from "vscode";
import { VerticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { getTheme } from "./util/getTheme";
import { getExtensionUri, getNonce, getUniqueId } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";

export class ContinueGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "continue.continueGUIView";
  public webviewProtocol: VsCodeWebviewProtocol;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._webview = webviewView.webview;
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
      this.ide,
      this.configHandler,
      this.verticalDiffManager,
    );
  }

  private _webview?: vscode.Webview;

  get webview() {
    return this._webview;
  }

  sendMainUserInput(input: string) {
    this.webview?.postMessage({
      type: "userInput",
      input,
    });
  }

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly verticalDiffManager: VerticalPerLineDiffManager,
  ) {
    this.webviewProtocol = new VsCodeWebviewProtocol(
      ide,
      configHandler,
      verticalDiffManager,
    );
  }

  getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    ide: IDE,
    configHandler: ConfigHandler,
    verticalDiffManager: VerticalPerLineDiffManager,
    page: string | undefined = undefined,
    edits: FileEdit[] | undefined = undefined,
    isFullScreen: boolean = false,
  ): string {
    let extensionUri = getExtensionUri();
    let scriptUri: string;
    let styleMainUri: string;
    let vscMediaUrl: string = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui"))
      .toString();

    const inDevelopmentMode =
      context?.extensionMode === vscode.ExtensionMode.Development;
    if (!inDevelopmentMode) {
      scriptUri = panel.webview
        .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
        .toString();
      styleMainUri = panel.webview
        .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
        .toString();
    } else {
      scriptUri = "http://localhost:5173/src/main.tsx";
      styleMainUri = "http://localhost:5173/src/index.css";
    }

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "gui"),
        vscode.Uri.joinPath(extensionUri, "assets"),
      ],
      enableCommandUris: true,
      portMapping: [
        {
          webviewPort: 65433,
          extensionHostPort: 65433,
        },
      ],
    };

    const nonce = getNonce();

    const currentTheme = getTheme();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.colorTheme")) {
        // Send new theme to GUI to update embedded Monaco themes
        this.webviewProtocol?.request("setTheme", { theme: getTheme() });
      }
    });

    this.webviewProtocol.webview = panel.webview;

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>const vscode = acquireVsCodeApi();</script>
        <link href="${styleMainUri}" rel="stylesheet">

        <title>Continue</title>
      </head>
      <body>
        <div id="root"></div>

        ${
          inDevelopmentMode
            ? `<script type="module">
          import RefreshRuntime from "http://localhost:5173/@react-refresh"
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
          </script>`
            : ""
        }

        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

        <script>localStorage.setItem("ide", "vscode")</script>
        <script>window.windowId = "${this.windowId}"</script>
        <script>window.vscMachineId = "${getUniqueId()}"</script>
        <script>window.vscMediaUrl = "${vscMediaUrl}"</script>
        <script>window.ide = "vscode"</script>
        <script>window.fullColorTheme = ${JSON.stringify(currentTheme)}</script>
        <script>window.colorThemeName = "dark-plus"</script>
        <script>window.workspacePaths = ${JSON.stringify(
          vscode.workspace.workspaceFolders?.map(
            (folder) => folder.uri.fsPath,
          ) || [],
        )}</script>
        <script>window.isFullScreen = ${isFullScreen}</script>

        ${
          edits
            ? `<script>window.edits = ${JSON.stringify(edits)}</script>`
            : ""
        }
        ${page ? `<script>window.location.pathname = "${page}"</script>` : ""}
      </body>
    </html>`;
  }
}
