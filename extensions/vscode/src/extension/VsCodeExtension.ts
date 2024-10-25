import { IContextProvider } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { controlPlaneEnv, EXTENSION_NAME } from "core/control-plane/env";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/util/messenger";
import { getConfigJsonPath, getConfigTsPath } from "core/util/paths";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import {
  monitorBatteryChanges,
  setupStatusBar,
  StatusBarStatus,
} from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { DiffManager } from "../diff/horizontal";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { QuickEdit } from "../quickEdit/QuickEditQuickPick";
import { setupRemoteConfigSync } from "../stubs/activation";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { arePathsEqual } from "../util/arePathsEqual";
import { Battery } from "../util/battery";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { VsCodeIde } from "../VsCodeIde";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";
import { VsCodeMessenger } from "./VsCodeMessenger";

export class VsCodeExtension {
  // Currently some of these are public so they can be used in testing (test/test-suites)

  private configHandler: ConfigHandler;
  private extensionContext: vscode.ExtensionContext;
  private ide: VsCodeIde;
  private tabAutocompleteModel: TabAutocompleteModel;
  private sidebar: ContinueGUIWebviewViewProvider;
  private windowId: string;
  private diffManager: DiffManager;
  private verticalDiffManager: VerticalDiffManager;
  webviewProtocolPromise: Promise<VsCodeWebviewProtocol>;
  private core: Core;
  private battery: Battery;
  private workOsAuthProvider: WorkOsAuthProvider;

  constructor(context: vscode.ExtensionContext) {
    // Register auth provider
    this.workOsAuthProvider = new WorkOsAuthProvider(context);
    this.workOsAuthProvider.refreshSessions();
    context.subscriptions.push(this.workOsAuthProvider);

    let resolveWebviewProtocol: any = undefined;
    this.webviewProtocolPromise = new Promise<VsCodeWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );
    this.diffManager = new DiffManager(context);
    this.ide = new VsCodeIde(this.diffManager, this.webviewProtocolPromise);
    this.extensionContext = context;
    this.windowId = uuidv4();

    // Dependencies of core
    let resolveVerticalDiffManager: any = undefined;
    const verticalDiffManagerPromise = new Promise<VerticalDiffManager>(
      (resolve) => {
        resolveVerticalDiffManager = resolve;
      },
    );
    let resolveConfigHandler: any = undefined;
    const configHandlerPromise = new Promise<ConfigHandler>((resolve) => {
      resolveConfigHandler = resolve;
    });
    this.sidebar = new ContinueGUIWebviewViewProvider(
      configHandlerPromise,
      this.windowId,
      this.extensionContext,
    );

    // Sidebar
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "continue.continueGUIView",
        this.sidebar,
        {
          webviewOptions: { retainContextWhenHidden: true },
        },
      ),
    );
    resolveWebviewProtocol(this.sidebar.webviewProtocol);

    // Config Handler with output channel
    const outputChannel = vscode.window.createOutputChannel(
      "Continue - LLM Prompt/Completion",
    );
    const inProcessMessenger = new InProcessMessenger<
      ToCoreProtocol,
      FromCoreProtocol
    >();

    new VsCodeMessenger(
      inProcessMessenger,
      this.sidebar.webviewProtocol,
      this.ide,
      verticalDiffManagerPromise,
      configHandlerPromise,
      this.workOsAuthProvider,
    );

    this.core = new Core(inProcessMessenger, this.ide, async (log: string) => {
      outputChannel.appendLine(
        "==========================================================================",
      );
      outputChannel.appendLine(
        "==========================================================================",
      );
      outputChannel.append(log);
    });
    this.configHandler = this.core.configHandler;
    resolveConfigHandler?.(this.configHandler);

    this.configHandler.reloadConfig();
    this.verticalDiffManager = new VerticalDiffManager(
      this.configHandler,
      this.sidebar.webviewProtocol,
    );
    resolveVerticalDiffManager?.(this.verticalDiffManager);
    this.tabAutocompleteModel = new TabAutocompleteModel(this.configHandler);

    setupRemoteConfigSync(
      this.configHandler.reloadConfig.bind(this.configHandler),
    );

    // Indexing + pause token
    this.diffManager.webviewProtocol = this.sidebar.webviewProtocol;

    this.configHandler.loadConfig().then((config) => {
      const { verticalDiffCodeLens } = registerAllCodeLensProviders(
        context,
        this.diffManager,
        this.verticalDiffManager.filepathToCodeLens,
        config,
      );

      this.verticalDiffManager.refreshCodeLens =
        verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);
    });

    this.configHandler.onConfigUpdate(
      ({ config: newConfig, errors, configLoadInterrupted }) => {
        if (configLoadInterrupted) {
          // Show error in status bar
          setupStatusBar(undefined, undefined, true);
        } else if (newConfig) {
          setupStatusBar(undefined, undefined, false);

          this.sidebar.webviewProtocol?.request("configUpdate", undefined);

          this.tabAutocompleteModel.clearLlm();

          registerAllCodeLensProviders(
            context,
            this.diffManager,
            this.verticalDiffManager.filepathToCodeLens,
            newConfig,
          );
        }

        this.sidebar.webviewProtocol?.request("configError", errors);
      },
    );

    // Tab autocomplete
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = config.get<boolean>("enableTabAutocomplete");

    // Register inline completion provider
    setupStatusBar(
      enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    );
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        new ContinueCompletionProvider(
          this.configHandler,
          this.ide,
          this.tabAutocompleteModel,
          this.sidebar.webviewProtocol,
        ),
      ),
    );

    // Battery
    this.battery = new Battery();
    context.subscriptions.push(this.battery);
    context.subscriptions.push(monitorBatteryChanges(this.battery));

    const quickEdit = new QuickEdit(
      this.verticalDiffManager,
      this.configHandler,
      this.sidebar.webviewProtocol,
      this.ide,
      context,
    );

    // Commands
    registerAllCommands(
      context,
      this.ide,
      context,
      this.sidebar,
      this.configHandler,
      this.diffManager,
      this.verticalDiffManager,
      this.core.continueServerClientPromise,
      this.battery,
      quickEdit,
      this.core,
    );

    // Disabled due to performance issues
    // registerDebugTracker(this.sidebar.webviewProtocol, this.ide);

    // Listen for file saving - use global file watcher so that changes
    // from outside the window are also caught
    fs.watchFile(getConfigJsonPath(), { interval: 1000 }, async (stats) => {
      await this.configHandler.reloadConfig();
    });

    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
    });

    vscode.workspace.onDidSaveTextDocument(async (event) => {
      // Listen for file changes in the workspace
      const filepath = event.uri.fsPath;

      if (arePathsEqual(filepath, getConfigJsonPath())) {
        // Trigger a toast notification to provide UI feedback that config
        // has been updated
        const showToast = context.globalState.get<boolean>(
          "showConfigUpdateToast",
          true,
        );

        if (showToast) {
          vscode.window
            .showInformationMessage("Config updated", "Don't show again")
            .then((selection) => {
              if (selection === "Don't show again") {
                context.globalState.update("showConfigUpdateToast", false);
              }
            });
        }
      }

      if (
        filepath.endsWith(".continuerc.json") ||
        filepath.endsWith(".prompt")
      ) {
        this.configHandler.reloadConfig();
      } else if (
        filepath.endsWith(".continueignore") ||
        filepath.endsWith(".gitignore")
      ) {
        // Reindex the workspaces
        this.core.invoke("index/forceReIndex", undefined);
      } else {
        // Reindex the file
        const indexer = await this.core.codebaseIndexerPromise;
        indexer.refreshFile(filepath);
      }
    });

    // When GitHub sign-in status changes, reload config
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === "github") {
        this.configHandler.reloadConfig();
      } else if (e.provider.id === controlPlaneEnv.AUTH_TYPE) {
        const sessionInfo = await getControlPlaneSessionInfo(true);
        this.webviewProtocolPromise.then(async (webviewProtocol) => {
          webviewProtocol.request("didChangeControlPlaneSessionInfo", {
            sessionInfo,
          });

          // To make sure continue-proxy models and anything else requiring it get updated access token
          this.configHandler.reloadConfig();
        });
        this.core.invoke("didChangeControlPlaneSessionInfo", { sessionInfo });
      }
    });

    // Refresh index when branch is changed
    this.ide.getWorkspaceDirs().then((dirs) =>
      dirs.forEach(async (dir) => {
        const repo = await this.ide.getRepo(vscode.Uri.file(dir));
        if (repo) {
          repo.state.onDidChange(() => {
            // args passed to this callback are always undefined, so keep track of previous branch
            const currentBranch = repo?.state?.HEAD?.name;
            if (currentBranch) {
              if (this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]) {
                if (
                  currentBranch !== this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir]
                ) {
                  // Trigger refresh of index only in this directory
                  this.core.invoke("index/forceReIndex", { dir });
                }
              }

              this.PREVIOUS_BRANCH_FOR_WORKSPACE_DIR[dir] = currentBranch;
            }
          });
        }
      }),
    );

    // Register a content provider for the readonly virtual documents
    const documentContentProvider = new (class
      implements vscode.TextDocumentContentProvider
    {
      // emitter and its event
      onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
      onDidChange = this.onDidChangeEmitter.event;

      provideTextDocumentContent(uri: vscode.Uri): string {
        return uri.query;
      }
    })();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        VsCodeExtension.continueVirtualDocumentScheme,
        documentContentProvider,
      ),
    );

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      this.core.invoke("didChangeActiveTextEditor", { filepath });
    });

    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(EXTENSION_NAME)) {
        const settings = this.ide.getIdeSettingsSync();
        const webviewProtocol = await this.webviewProtocolPromise;
        webviewProtocol.request("didChangeIdeSettings", {
          settings,
        });
      }
    });
  }

  static continueVirtualDocumentScheme = EXTENSION_NAME;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private PREVIOUS_BRANCH_FOR_WORKSPACE_DIR: { [dir: string]: string } = {};

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.configHandler.registerCustomContextProvider(contextProvider);
  }
}
