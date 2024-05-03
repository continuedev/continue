import { ConfigHandler } from "core/config/handler";
import { CodebaseIndexer, PauseToken } from "core/indexing/indexCodebase";
import { IdeSettings } from "core/protocol";
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
import { getUserToken } from "../stubs/auth";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { VsCodeWebviewProtocol } from "../webviewProtocol";

export class VsCodeExtension {
  private configHandler: ConfigHandler;
  private extensionContext: vscode.ExtensionContext;
  private ide: VsCodeIde;
  private tabAutocompleteModel: TabAutocompleteModel;
  private sidebar: ContinueGUIWebviewViewProvider;
  private windowId: string;
  private indexer: CodebaseIndexer;
  private diffManager: DiffManager;
  private verticalDiffManager: VerticalPerLineDiffManager;
  private webviewProtocol: VsCodeWebviewProtocol;

  constructor(context: vscode.ExtensionContext) {
    this.diffManager = new DiffManager(context);
    this.ide = new VsCodeIde(this.diffManager);

    const settings = vscode.workspace.getConfiguration("continue");
    const remoteConfigServerUrl = settings.get<string | undefined>(
      "remoteConfigServerUrl",
      undefined,
    );
    const ideSettings: IdeSettings = {
      remoteConfigServerUrl,
      remoteConfigSyncPeriod: settings.get<number>(
        "remoteConfigSyncPeriod",
        60,
      ),
      userToken: settings.get<string>("userToken", ""),
    };

    // Config Handler with output channel
    const outputChannel = vscode.window.createOutputChannel(
      "Continue - LLM Prompt/Completion",
    );
    this.configHandler = new ConfigHandler(
      this.ide,
      Promise.resolve(ideSettings),
      async (log: string) => {
        outputChannel.appendLine(
          "==========================================================================",
        );
        outputChannel.appendLine(
          "==========================================================================",
        );
        outputChannel.append(log);
      },
      (() => this.webviewProtocol?.request("configUpdate", undefined)).bind(
        this,
      ),
    );

    this.configHandler.reloadConfig();
    this.verticalDiffManager = new VerticalPerLineDiffManager(
      this.configHandler,
    );
    this.extensionContext = context;
    this.tabAutocompleteModel = new TabAutocompleteModel(this.configHandler);
    this.windowId = uuidv4();
    this.sidebar = new ContinueGUIWebviewViewProvider(
      this.configHandler,
      this.ide,
      this.windowId,
      this.extensionContext,
      this.verticalDiffManager,
    );

    setupRemoteConfigSync(
      this.configHandler.reloadConfig.bind(this.configHandler),
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
    this.webviewProtocol = this.sidebar.webviewProtocol;

    // Indexing + pause token
    const indexingPauseToken = new PauseToken(
      context.globalState.get<boolean>("continue.indexingPaused") === true,
    );
    this.webviewProtocol.on("index/setPaused", (msg) => {
      context.globalState.update("continue.indexingPaused", msg.data);
      indexingPauseToken.paused = msg.data;
    });
    this.webviewProtocol.on("index/forceReIndex", (msg) => {
      this.ide
        .getWorkspaceDirs()
        .then((dirs) => this.refreshCodebaseIndex(dirs, context));
      context.globalState.update("continue.indexingFailed", false)
    });
    this.webviewProtocol.on("index/setIndexingFailed", (msg) => {
      this.webviewProtocol?.request("setIndexingFailed", msg.data); 
      context.globalState.update("continue.indexingFailed", msg.data)
    });
    this.webviewProtocol.on("index/indexingProgressBarInitialized", (msg) => {
      if (context.globalState.get("continue.indexingFailed")){
        this.webviewProtocol?.request("setIndexingFailed", {failed: true});
      } else {
        this.webviewProtocol?.request("setIndexingFailed", {failed: false});
      }
    });
    
    this.diffManager.webviewProtocol = this.webviewProtocol;

    const userTokenPromise: Promise<string | undefined> = new Promise(
      async (resolve) => {
        if (
          remoteConfigServerUrl === null ||
          remoteConfigServerUrl === undefined ||
          remoteConfigServerUrl.trim() === ""
        ) {
          resolve(undefined);
          return;
        }
        const token = await getUserToken();
        resolve(token);
      },
    );
    this.indexer = new CodebaseIndexer(
      this.configHandler,
      this.ide,
      indexingPauseToken,
      ideSettings.remoteConfigServerUrl,
      userTokenPromise,
    );

    if (
      !(
        remoteConfigServerUrl === null ||
        remoteConfigServerUrl === undefined ||
        remoteConfigServerUrl.trim() === ""
      )
    ) {
      getUserToken().then((token) => {});
    }

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
    );

    registerDebugTracker(this.webviewProtocol, this.ide);

    // Indexing
    this.ide.getWorkspaceDirs().then((dirs) => this.refreshCodebaseIndex(dirs, context));

    // Listen for file saving - use global file watcher so that changes
    // from outside the window are also caught
    fs.watchFile(getConfigJsonPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
      this.tabAutocompleteModel.clearLlm();
    });
    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      this.configHandler.reloadConfig();
      this.tabAutocompleteModel.clearLlm();
    });

    vscode.workspace.onDidSaveTextDocument((event) => {
      // Listen for file changes in the workspace
      const filepath = event.uri.fsPath;

      if (filepath.endsWith(".continuerc.json")) {
        this.configHandler.reloadConfig();
        this.tabAutocompleteModel.clearLlm();
      } else if (
        filepath.endsWith(".continueignore") ||
        filepath.endsWith(".gitignore")
      ) {
        // Update embeddings! (TODO)
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
                  this.refreshCodebaseIndex([dir], context);
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
  private indexingCancellationController: AbortController | undefined;

  private async refreshCodebaseIndex(dirs: string[], context: vscode.ExtensionContext) {
    this.webviewProtocol?.request("setIndexingFailed", {failed:false});
    context.globalState.update("continue.indexingFailed", false)

    if (this.indexingCancellationController) {
      this.indexingCancellationController.abort();
    }
    this.indexingCancellationController = new AbortController();
    let err = undefined
    for await (const update of this.indexer.refresh(
      dirs,
      this.indexingCancellationController.signal,
    )) {
      if (update.indexingFailed) {
        err = update.desc

        // Signal to front-end
        this.webviewProtocol?.request("setIndexingFailed", {failed: true});
        context.globalState.update("continue.indexingFailed", true)

        break
      } else {
        this.webviewProtocol.request("indexProgress", update);
      }
    }

    if (err) {
      console.log("Codebase Indexing Failed: ", err)
    } else {
      console.log("Codebase Indexing Complete")
    }
    
  }
}
