import { IContextProvider } from "core";
import { ConfigHandler } from "core/config/handler";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/util/messenger";
import { getConfigJsonPath, getConfigTsPath } from "core/util/paths";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import { setupStatusBar } from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { registerDebugTracker } from "../debug/debug";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
import { DiffManager } from "../diff/horizontal";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeIde } from "../ideProtocol";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { setupRemoteConfigSync } from "../stubs/activation";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
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
  private verticalDiffManager: VerticalPerLineDiffManager;
  webviewProtocolPromise: Promise<VsCodeWebviewProtocol>;
  private core: Core;

  constructor(context: vscode.ExtensionContext) {
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

    const ideSettings = this.ide.getIdeSettingsSync();
    const { remoteConfigServerUrl } = ideSettings;

    // Dependencies of core
    let resolveVerticalDiffManager: any = undefined;
    const verticalDiffManagerPromise = new Promise<VerticalPerLineDiffManager>(
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
    const vscodeMessenger = new VsCodeMessenger(
      inProcessMessenger,
      this.sidebar.webviewProtocol,
      this.ide,
      verticalDiffManagerPromise,
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
    this.configHandler.onConfigUpdate(() => {
      this.sidebar.webviewProtocol?.request("configUpdate", undefined);
    });

    this.configHandler.reloadConfig();
    this.verticalDiffManager = new VerticalPerLineDiffManager(
      this.configHandler,
    );
    resolveVerticalDiffManager?.(this.verticalDiffManager);
    this.tabAutocompleteModel = new TabAutocompleteModel(this.configHandler);

    setupRemoteConfigSync(
      this.configHandler.reloadConfig.bind(this.configHandler),
    );

    // Indexing + pause token
    this.diffManager.webviewProtocol = this.sidebar.webviewProtocol;

    // CodeLens
    const verticalDiffCodeLens = registerAllCodeLensProviders(
      context,
      this.diffManager,
      this.verticalDiffManager.filepathToCodeLens,
    );
    this.verticalDiffManager.refreshCodeLens =
      verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);

    // Tab autocomplete
    const config = vscode.workspace.getConfiguration("continue");
    const enabled = config.get<boolean>("enableTabAutocomplete");

    // Register inline completion provider
    setupStatusBar(enabled);
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        new ContinueCompletionProvider(
          this.configHandler,
          this.ide,
          this.tabAutocompleteModel,
        ),
      ),
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
    );

    registerDebugTracker(this.sidebar.webviewProtocol, this.ide);

    // Listen for file saving - use global file watcher so that changes
    // from outside the window are also caught
    fs.watchFile(getConfigJsonPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
    });
    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
    });

    this.configHandler.onConfigUpdate(
      this.tabAutocompleteModel.clearLlm.bind(this.tabAutocompleteModel),
    );

    vscode.workspace.onDidSaveTextDocument((event) => {
      // Listen for file changes in the workspace
      const filepath = event.uri.fsPath;

      if (
        filepath.endsWith(".continuerc.json") ||
        filepath.endsWith(".prompt")
      ) {
        this.configHandler.reloadConfig();
      } else if (
        filepath.endsWith(".continueignore") ||
        filepath.endsWith(".gitignore")
      ) {
        // Update embeddings! (TODO)
      }
    });

    // When GitHub sign-in status changes, reload config
    vscode.authentication.onDidChangeSessions((e) => {
      if (e.provider.id === "github") {
        this.configHandler.reloadConfig();
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
                  this.core.invoke("index/forceReIndex", dir);
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
  }

  static continueVirtualDocumentScheme = "continue";

  private PREVIOUS_BRANCH_FOR_WORKSPACE_DIR: { [dir: string]: string } = {};

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.configHandler.registerCustomContextProvider(contextProvider);
  }
}
