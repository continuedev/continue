import { LocalModelSize } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import {
  DEFAULT_MODEL_GRANITE_LARGE,
  DEFAULT_MODEL_GRANITE_SMALL,
} from "core/config/default";
import { EXTENSION_NAME } from "core/control-plane/env";
import { SHOW_GRANITE_ONBOARDING_CARD_KEY } from "core/granite/commons/constants";
import { DOWNLOADABLE_MODELS } from "core/granite/commons/modelRequirements";
import { ProgressData } from "core/granite/commons/progressData";
import { ModelStatus, ServerStatus } from "core/granite/commons/statuses";
import { checkMinimumServerVersion } from "core/granite/commons/versions";
import {
  FINAL_STEP,
  MODELS_STEP,
  OLLAMA_STEP,
  WizardState,
} from "core/granite/commons/wizardState";
import {
  commands,
  Disposable,
  ExtensionContext,
  ExtensionMode,
  Uri,
  ViewColumn,
  Webview,
  WebviewPanel,
  window,
  workspace,
} from "vscode";

import { VsCodeWebviewProtocol } from "../../webviewProtocol";
import { OllamaServer } from "../ollama/ollamaServer";
import { CancellationController } from "../utils/cancellationController";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { getSystemInfo } from "../utils/sysUtils";

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */

export class SetupGranitePage {
  public static currentPanel: SetupGranitePage | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private server: OllamaServer;
  private wizardState: WizardState;

  /**
   * The HelloWorldPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(
    panel: WebviewPanel,
    private context: ExtensionContext,
    private configHandler: ConfigHandler,
    private chatWebViewProtocol: VsCodeWebviewProtocol,
    defaultState?: WizardState,
  ) {
    this._panel = panel;
    this._disposables.push(this._panel);
    this.server = new OllamaServer(context);
    this.wizardState = defaultState
      ? defaultState
      : ({ stepStatuses: [false, false, false] } as WizardState);

    // Set up dispose handler with confirmation dialog
    this._disposables.push(this._panel.onDidDispose(
      async () => {
        // Verify setup is complete by checking if ollama and the models are configured
        const isComplete =
          this.wizardState.stepStatuses[OLLAMA_STEP] &&
          this.wizardState.stepStatuses[MODELS_STEP];
        let reopen = false;
        if (!isComplete) {
          const RESUME_LABEL = "Resume Setup";
          const choice = await window.showWarningMessage(
            "Resume Granite.Code Setup?",
            {
              modal: true,
              detail:
                "Granite.Code needs to be setup before it can be used. Setup is not yet complete.",
            },
            RESUME_LABEL, // Cancel is always shown
          );
          reopen = choice === RESUME_LABEL;
        }
        this.dispose();
        if (reopen) {
          SetupGranitePage.render(
            context,
            configHandler,
            this.chatWebViewProtocol,
            this.wizardState,
          );
        }
      },
      null,
      this._disposables,
    ));

    // Add visibility change detection in the webview panel
    this._disposables.push(this._panel.onDidChangeViewState((event) => {
      this._panel.webview.postMessage({
        command: "visibilityChange",
        data: {
          isVisible: event.webviewPanel.visible
        }
      });
    }));

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      context,
    );

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel);

    // Send a new status on configuration changes
    const cleanupConfigUpdate = configHandler.onConfigUpdate(({ config }) => {
      this.publishStatus(this._panel.webview);
    });
    this._disposables.push(new Disposable(cleanupConfigUpdate));
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(
    context: ExtensionContext,
    configHandler: ConfigHandler,
    chatWebViewProtocol: VsCodeWebviewProtocol,
    wizardState?: WizardState,
  ) {
    if (SetupGranitePage.currentPanel) {
      // If the webview panel already exists reveal it
      SetupGranitePage.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      // If a webview panel does not already exist create and show a new one
      const extensionUri = context.extensionUri;
      const panel = window.createWebviewPanel(
        // Panel view type
        "modelSetup",
        // Panel title
        "Setup Granite.Code",
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          retainContextWhenHidden: true,
          // Restrict the webview to only load resources from the `gui` directory
          localResourceRoots: [Uri.joinPath(extensionUri, "gui")],
        },
      );

      SetupGranitePage.currentPanel = new SetupGranitePage(
        panel,
        context,
        configHandler,
        chatWebViewProtocol,
        wizardState,
      );
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    SetupGranitePage.currentPanel = undefined;
    // Dispose of all disposables
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
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
  private _getWebviewContent(webview: Webview, context: ExtensionContext) {
    let stylesUri, scriptUri;
    const extensionUri = context.extensionUri;
    const vscMediaUrl = getUri(webview, extensionUri, ["gui"]).toString();

    if (context.extensionMode === ExtensionMode.Development) {
      scriptUri = "http://localhost:5173/src/granite/indexSetupGranite.tsx";
      stylesUri = "http://localhost:5173/src/granite/indexSetupGranite.css";
    } else {
      // The CSS file from the React build output
      stylesUri = getUri(webview, extensionUri, [
        "gui",
        "assets",
        "indexSetupGranite.css",
      ]);
      // The JS file from the React build output
      scriptUri = getUri(webview, extensionUri, [
        "gui",
        "assets",
        "indexSetupGranite.js",
      ]);
    }

    const inDevelopmentMode =
      context?.extensionMode === ExtensionMode.Development;

    const devStyleSrc = inDevelopmentMode ? "http://localhost:5173" : "";
    const devConnectSrc = inDevelopmentMode ? "ws://localhost:5173" : "";

    const nonce = getNonce();
    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src ${webview.cspSource} ${devStyleSrc} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${devConnectSrc} 'self'; img-src https: ${webview.cspSource} data:">
          <script nonce="${nonce}">const vscode = acquireVsCodeApi();</script>
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Granite Models</title>
          </head>
          <body>
          <div id="root"></div>
          ${
            inDevelopmentMode
              ? `<script type="module" nonce="${nonce}">
            import RefreshRuntime from "http://localhost:5173/@react-refresh"
            RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {}
            window.$RefreshSig$ = () => (type) => type
            window.__vite_plugin_react_preamble_installed__ = true
            </script>`
              : ""
          }
          <script type="module" nonce="${nonce}">
            window.vscMediaUrl="${vscMediaUrl}";
          </script>
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
  private debounceStatus = 0;
  private modelInstallCanceller: CancellationController | undefined;
  private ollamaInstallCanceller: CancellationController | undefined;

  private _setWebviewMessageListener(panel: WebviewPanel) {
    const webview = panel.webview;
    webview.onDidReceiveMessage(
      async (message: any) => {
        const command = message.command;
        const data = message.data;

        switch (command) {
          case "init":
            webview.postMessage({
              command: "init",
              data: {
                installModes: await this.server.supportedInstallModes(),
                systemInfo: await getSystemInfo(),
                wizardState: this.wizardState,
              },
            });
            break;
          case "installOllama":
            await this.installOllama(data.mode, panel);
            break;
          case "showTutorial":
            this.wizardState.stepStatuses[FINAL_STEP] = true;
            this.publishStatus(webview);
            await this.showTutorial();
            break;
          case "cancelInstallation":
            const target = data.target;
            if ("ollama" === target) {
              console.log("Cancelling ollama installation");
              this.ollamaInstallCanceller?.cancel();
            } else {
              // models
              console.log("Cancelling model installation");
              this.modelInstallCanceller?.cancel();
            }
            break;
          case "fetchStatus":
            const now = new Date().getTime();
            // Careful here, we're receiving 2 messages in Dev mode on useEffect, because <GraniteWizard> is wrapped with <React.StrictMode>
            // see https://stackoverflow.com/questions/60618844/react-hooks-useeffect-is-called-twice-even-if-an-empty-array-is-used-as-an-ar

            if (this.debounceStatus > 0) {
              const elapsed = now - this.debounceStatus;
              if (elapsed < 50) {
                console.log("Debouncing fetchStatus :" + elapsed);
                break;
              }
            }
            this.debounceStatus = now;

            this.publishStatus(webview);
            break;
          case "selectModels":
            this.wizardState.selectedModelSize = data.model as LocalModelSize;
            break;
          case "installModels":
            await this.installModels(data.model as LocalModelSize, panel);
            break;
        }
      },
      undefined,
      this._disposables,
    );
  }

  private async installOllama(mode: string, panel: WebviewPanel) {
    const webview = panel.webview;
    this.ollamaInstallCanceller?.dispose();
    this.ollamaInstallCanceller = new CancellationController();
    this._disposables.push(this.ollamaInstallCanceller);

    async function reportProgress(progress: ProgressData) {
      if (mode !== "windows") {
        return;
      }
      webview.postMessage({
        command: "ollamaInstallationProgress",
        data: {
          progress,
        },
      });
    }

    // Convert CancellationToken to AbortSignal
    await this.server.installServer(
      mode,
      this.ollamaInstallCanceller.signal,
      reportProgress,
    );
  }

  private async installModels(modelSize: LocalModelSize, panel: WebviewPanel) {
    // Check if the server is running, if not, start it and wait for it to be ready until timeout is reached
    var { serverState, timeout } = await this.waitUntilOllamaStarts();
    const webview = panel.webview;
    if (serverState.status !== ServerStatus.started) {
      const errorMessage = `Ollama server failed to start in ${timeout / 1000} seconds`;
      console.error(errorMessage);
      webview.postMessage({
        command: "modelInstallationProgress",
        data: {
          error: errorMessage,
        },
      });
      return;
    }
    console.log("Installing models");

    async function reportProgress(progress: ProgressData) {
      webview.postMessage({
        command: "modelInstallationProgress",
        data: {
          progress,
        },
      });
    }
    this.modelInstallCanceller?.dispose();
    this.modelInstallCanceller = new CancellationController();
    this._disposables.push(this.modelInstallCanceller);
    try {
      this.wizardState.selectedModelSize = modelSize;
      const graniteModel =
        modelSize === "large"
          ? DEFAULT_MODEL_GRANITE_LARGE
          : DEFAULT_MODEL_GRANITE_SMALL;

      const result = await this.server.pullModels(
        [graniteModel.model, "nomic-embed-text:latest"],
        this.modelInstallCanceller.signal,
        reportProgress,
      );
      this.wizardState.stepStatuses[MODELS_STEP] = result;
      this.publishStatus(webview);
      if (result) {
        await this.saveSettings(modelSize);
        this.hideGraniteOnboardingCard();
        commands.executeCommand("continue.continueGUIView.focus");
        if (!panel.visible) {
          const selection = await window.showInformationMessage(
            "Granite.Code is ready to be used.",
            "Show Setup Wizard",
          );
          if (selection) {
            panel.reveal();
          }
        }
      }
    } catch (error: any) {
      console.error("Error during model installation", error);
      webview.postMessage({
        command: "modelInstallationProgress",
        data: {
          error: error.message,
        },
      });
    }
  }

  private hideGraniteOnboardingCard() {
    this.context.globalState.update(SHOW_GRANITE_ONBOARDING_CARD_KEY, false);
    commands.executeCommand("setContext", "granite.initialized", true);
    this.chatWebViewProtocol.send("setShowGraniteOnboardingCard", false);
  }

  private async waitUntilOllamaStarts() {
    let serverState = await this.server.getState();
    const timeout = 30000;
    const interval = 500;
    if (serverState.status !== ServerStatus.started) {
      console.log("Starting ollama server");
      await this.server.startServer();
      // Check if the server is running until timeout is reached
      for (let i = 0; i < timeout / interval; i++) {
        serverState = await this.server.getState();
        if (serverState.status === ServerStatus.started) {
          break;
        }
        console.log("Waiting for ollama server to start " + i);
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
    return { serverState, timeout };
  }

  async getStatusByModel(): Promise<Map<string, ModelStatus>> {
    const statusByModel: Map<string, ModelStatus> = new Map();
    await Promise.all(
      DOWNLOADABLE_MODELS.map(async (id) => {
        const status = await this.server.getModelStatus(id);
        statusByModel.set(id, status);
      }),
    );
    return statusByModel;
  }

  async publishStatus(webview: Webview) {
    // console.log("Received fetchStatus msg " + debounceStatus);
    const [serverState, statusByModel] = await Promise.all([
      this.server.getState(),
      this.getStatusByModel(),
    ]);
    const statusByModelObject = Object.fromEntries(statusByModel); // Convert Map to Object
    const serverVersion = serverState.version;
    this.wizardState.stepStatuses[OLLAMA_STEP] = serverVersion !== undefined && checkMinimumServerVersion(serverVersion) && (
      serverState.status === ServerStatus.started ||
      serverState.status === ServerStatus.stopped);
    webview.postMessage({
      command: "status",
      data: {
        serverState,
        statusByModel: statusByModelObject,
        wizardState: this.wizardState,
      },
    });
  }

  async showTutorial() {
    await commands.executeCommand("granite.showTutorial");
  }

  async saveSettings(modelSize: LocalModelSize): Promise<void> {
    console.log("Saving settings for model size: " + modelSize);
    const config = workspace.getConfiguration(EXTENSION_NAME);
    await config.update("localModelSize", modelSize, true);
  }
}
