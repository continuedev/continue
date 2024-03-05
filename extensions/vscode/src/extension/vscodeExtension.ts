import { ConfigHandler } from "core/config/handler";
import { CodebaseIndexer, PauseToken } from "core/indexing/indexCodebase";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import { setupStatusBar } from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { ContinueGUIWebviewViewProvider } from "../debugPanel";
import { DiffManager } from "../diff/horizontal";
import { VerticalPerLineDiffManager } from "../diff/verticalPerLine/manager";
import { VsCodeIde } from "../ideProtocol";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { TabAutocompleteModel } from "../util/loadAutocompleteModel";
import { RemoteConfigSync } from "../util/remoteConfig";
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
    const remoteUrl = vscode.workspace
      .getConfiguration("continue")
      .get<string | undefined>("remoteConfigServerUrl", undefined);

    // Config Handler with output channel
    const outputChannel = vscode.window.createOutputChannel(
      "Continue - LLM Prompt/Completion",
    );
    this.configHandler = new ConfigHandler(
      this.ide,
      typeof remoteUrl !== "string" || remoteUrl === ""
        ? undefined
        : new URL(remoteUrl),
      async (log: string) => {
        outputChannel.appendLine(
          "==========================================================================",
        );
        outputChannel.appendLine(
          "==========================================================================",
        );
        outputChannel.append(log);
      },
      () => this.webviewProtocol?.request("configUpdate", undefined),
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
    try {
      const configSync = new RemoteConfigSync(
        this.configHandler.reloadConfig.bind(this.configHandler),
      );
      configSync.setup();
    } catch (e) {
      console.warn(`Failed to sync remote config: ${e}`);
    }

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

    this.diffManager.webviewProtocol = this.webviewProtocol;
    this.indexer = new CodebaseIndexer(
      this.configHandler,
      this.ide,
      indexingPauseToken,
    );

    // CodeLens
    registerAllCodeLensProviders(
      context,
      this.diffManager,
      this.verticalDiffManager.editorToVerticalDiffCodeLens,
    );

    // Tab autocomplete
    const config = vscode.workspace.getConfiguration("continue");
    const enabled = config.get<boolean>("enableTabAutocomplete");

    // Register inline completion provider (odd versions are pre-release)
    if (
      parseInt(context.extension.packageJSON.version.split(".")[1]) % 2 !==
      0
    ) {
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
    }

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

    // Indexing
    this.ide.getWorkspaceDirs().then((dirs) => this.refreshCodebaseIndex(dirs));

    // Listen for file saving
    vscode.workspace.onDidSaveTextDocument((event) => {
      const filepath = event.uri.fsPath;

      if (
        filepath.endsWith(".continue/config.json") ||
        filepath.endsWith(".continue\\config.json") ||
        filepath.endsWith(".continue/config.ts") ||
        filepath.endsWith(".continue\\config.ts") ||
        filepath.endsWith(".continuerc.json")
      ) {
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
                  this.refreshCodebaseIndex([dir]);
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

  private async refreshCodebaseIndex(dirs: string[]) {
    for await (const update of this.indexer.refresh(dirs)) {
      this.webviewProtocol.request("indexProgress", update);
    }
  }
}
