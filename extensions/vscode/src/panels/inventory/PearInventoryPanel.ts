import {
  Webview,
  window,
  Uri,
  ExtensionContext,
  WebviewView,
  WebviewViewProvider,
} from "vscode";
import { getNonce } from "../../util/vscode";
import { getUri } from "../../util/vscode";

/**
 * This class manages the state and behavior of PearInventory webview panel.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering PearInventoryPanel webview panels
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class PearInventoryPanel implements WebviewViewProvider {
  public static currentView: PearInventoryPanel | undefined;
  private _view?: WebviewView;
  public hardCoded = Uri.parse(
    "Users/fryingpan/code/pearai-app/extensions/pearai-submodule",
  );

  /**
   * The PearInventoryPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  public constructor(
    private _extensionUri: Uri,
    private readonly _extensionContext: ExtensionContext,
  ) {
    this._extensionUri = Uri.joinPath(_extensionUri, "..", "pearai-submodule");
    console.log("Extension Uri: ", this._extensionUri);
  }

  public resolveWebviewView(webviewView: WebviewView) {
    console.log("Resolving WebviewView for ChatView3: ", this._extensionUri);
    this._view = webviewView;

    // console.log("=========================== Hard coded: ", this.hardCoded);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this._extensionUri, "build", "vscode", "out"),
        Uri.joinPath(this._extensionUri, "gui", "build"),
      ],
    };

    webviewView.webview.html = this._getWebviewContent(
      webviewView.webview,
      this._extensionUri,
    );

    this._setWebviewMessageListener(webviewView.webview);
    console.log("success in resolveWebviewView!");
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the React webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, this._extensionUri, [
      "gui",
      "build",
      "assets",
      "index.css",
    ]);
    console.log("STYLES ===================:", stylesUri);
    // The JS file from the React build output
    const scriptUri = getUri(webview, this._extensionUri, [
      "gui",
      "build",
      "assets",
      "index.js",
    ]);
    console.log("SCRIPT ===================:", scriptUri);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>PearAI Inventory</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage((message: any) => {
      const command = message.command;
      const text = message.text;

      switch (command) {
        case "saveInventory":
          // Code that should run in response to the hello message command
          console.log("message here!");
          window.showInformationMessage(text);
          return;
        // Add more switch case statements here as more webview message commands
        // are created within the webview context (i.e. inside media/main.js)
      }
    });
  }

  public async deactivate() {
    console.log("Deactivating Pear Inventory");
  }
}

// // TODO: Disposal?
// /**
//  * Cleans up and disposes of webview resources when the webview panel is closed.
//  */
//  public dispose() {
// 	PearInventoryPanel.currentPanel = undefined;

//  	// Dispose of the current webview panel
//  	this._panel.dispose();

//  	// Dispose of all disposables (i.e. commands) for the current webview panel
//  	while (this._disposables.length) {
//  		const disposable = this._disposables.pop();
// 		if (disposable) {
//  			disposable.dispose();
//  		}
//  	}
// }
