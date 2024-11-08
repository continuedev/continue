import type { FileEdit } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { getTheme, getThemeType } from "./util/getTheme";
import * as vscode from "vscode";
import { getExtensionVersion } from "./util/util";
import { getExtensionUri, getNonce, getUniqueId } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";
import { isFirstLaunch } from "./copySettings";

// The overlay's webview title/id is defined in pearai-app's PearOverlayParts.ts
// A unique identifier is needed for the messaging protocol to distinguish the webviews.
export const PEAR_OVERLAY_VIEW_ID = "pearai.pearOverlay"
export const PEAR_CONTINUE_VIEW_ID = "pearai.pearAIChatView";

export class ContinueGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = PEAR_CONTINUE_VIEW_ID;
  public webviewProtocol: VsCodeWebviewProtocol;
  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;
  private outputChannel: vscode.OutputChannel;
  private enableDebugLogs: boolean;

  private updateDebugLogsStatus() {
    const settings = vscode.workspace.getConfiguration("pearai");
    this.enableDebugLogs = settings.get<boolean>("enableDebugLogs", false);
    if (this.enableDebugLogs) {
      this.outputChannel.show(true);
    } else {
      this.outputChannel.hide();
    }
  }

  // Show or hide the output channel on enableDebugLogs
  private setupDebugLogsListener() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("pearai.enableDebugLogs")) {
        const settings = vscode.workspace.getConfiguration("pearai");
        const enableDebugLogs = settings.get<boolean>("enableDebugLogs", false);
        if (enableDebugLogs) {
          this.outputChannel.show(true);
        } else {
          this.outputChannel.hide();
        }
      }
    });
  }

  private async handleWebviewMessage(message: any) {
    if (message.messageType === "log") {
      const settings = vscode.workspace.getConfiguration("pearai");
      const enableDebugLogs = settings.get<boolean>("enableDebugLogs", false);

      if (message.level === "debug" && !enableDebugLogs) {
        return; // Skip debug logs if enableDebugLogs is false
      }

      const timestamp = new Date().toISOString().split(".")[0];
      const logMessage = `[${timestamp}] [${message.level.toUpperCase()}] ${message.text}`;
      this.outputChannel.appendLine(logMessage);
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._webview = webviewView.webview;

    this._webview.onDidReceiveMessage((message) => {
      return this.handleWebviewMessage(message);
    });
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
    );
  }

  get isVisible() {
    return this._webviewView?.visible;
  }

  get webview() {
    return this._webview;
  }

  public resetWebviewProtocolWebview(): void {
    if (this._webview) {
      this.webviewProtocol.resetWebviewToDefault()
    } else {
      console.warn("no webview found during reset");
    }
  }

  sendMainUserInput(input: string) {
    this.webview?.postMessage({
      type: "userInput",
      input,
    });
  }

  constructor(
    private readonly configHandlerPromise: Promise<ConfigHandler>,
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {
    this.outputChannel = vscode.window.createOutputChannel("PearAI");
    this.enableDebugLogs = false;
    this.updateDebugLogsStatus();
    this.setupDebugLogsListener();

    this.webviewProtocol = new VsCodeWebviewProtocol(
      (async () => {
        const configHandler = await this.configHandlerPromise;
        return configHandler.reloadConfig();
      }).bind(this),
    );
  }

  getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    page: string | undefined = undefined,
    edits: FileEdit[] | undefined = undefined,
    isFullScreen = false,
    initialRoute: string = "/"
  ): string {
    const isOverlay = panel?.title === PEAR_OVERLAY_VIEW_ID; // defined in pearai-app PearOverlayPart.ts
    const extensionUri = getExtensionUri();
    let scriptUri: string;
    let styleMainUri: string;
    const vscMediaUrl: string = panel.webview
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
        this.webviewProtocol?.request("setThemeType", {
          themeType: getThemeType(),
        });
      }
    });

    this.webviewProtocol.addWebview(panel?.title === PEAR_OVERLAY_VIEW_ID? panel.title : panel.viewType, panel.webview);

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>
          const vscode = acquireVsCodeApi();
        </script>
        <link href="${styleMainUri}" rel="stylesheet">

        <title>PearAI</title>
      </head>
      <body>
        <div id="root"></div>

        ${`<script>
        function log(level, ...args) {
          const text = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' ');
          vscode.postMessage({ messageType: 'log', level, text, messageId: "log" });
        }

        window.console.log = (...args) => log('log', ...args);
        window.console.info = (...args) => log('info', ...args);
        window.console.warn = (...args) => log('warn', ...args);
        window.console.error = (...args) => log('error', ...args);
        window.console.debug = (...args) => log('debug', ...args);

        console.debug('Logging initialized');
        </script>`}
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

        <script>localStorage.setItem("ide", '"vscode"')</script>
        <script>localStorage.setItem("extensionVersion", '"${getExtensionVersion()}"')</script>
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
        <script>window.isFirstLaunch = ${isFirstLaunch(this.extensionContext)}</script>
        <script>window.isFullScreen = ${isFullScreen}</script>
        <script>window.isPearOverlay = ${isOverlay}</script>
        <script>window.initialRoute = "${initialRoute}"</script>

        ${
          edits
            ? `<script>window.edits = ${JSON.stringify(edits)}</script>`
            : ""
        }
        ${page ? `<script>window.location.pathname = "${page}"</script>` : ""}
      </body>
      ${isOverlay ? `
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: transparent;
              width: 100vw;
              height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              position: fixed;
              top: 0;
              left: 0;
            }
            
            #root {
              width: 80%;
              height: 80%;
            }
          </style>
          <script>
            document.body.addEventListener('click', function(e) {
                if (e.target === document.body) {
                    vscode.postMessage({ messageType: 'closeOverlay', messageId: "closeOverlay" });
                }
            });
          </script>
      `: ""}
    </html>`;
  }
}
