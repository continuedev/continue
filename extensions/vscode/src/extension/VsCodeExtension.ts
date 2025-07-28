import fs from "fs";

import { IContextProvider } from "core";
import { ConfigHandler } from "core/config/ConfigHandler";
import { EXTENSION_NAME, getControlPlaneEnv } from "core/control-plane/env";
import { Core } from "core/core";
import { FromCoreProtocol, ToCoreProtocol } from "core/protocol";
import { InProcessMessenger } from "core/protocol/messenger";
import {
  getConfigJsonPath,
  getConfigTsPath,
  getConfigYamlPath,
} from "core/util/paths";
import { v4 as uuidv4 } from "uuid";
import * as vscode from "vscode";

import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import {
  monitorBatteryChanges,
  setupStatusBar,
  StatusBarStatus,
} from "../autocomplete/statusBar";
import { registerAllCommands } from "../commands";
import { ContinueConsoleWebviewViewProvider } from "../ContinueConsoleWebviewViewProvider";
import { ContinueGUIWebviewViewProvider } from "../ContinueGUIWebviewViewProvider";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { registerAllCodeLensProviders } from "../lang-server/codeLens";
import { registerAllPromptFilesCompletionProviders } from "../lang-server/promptFileCompletions";
import EditDecorationManager from "../quickEdit/EditDecorationManager";
import { QuickEdit } from "../quickEdit/QuickEditQuickPick";
import { setupRemoteConfigSync } from "../stubs/activation";
import { UriEventHandler } from "../stubs/uriHandler";
import {
  getControlPlaneSessionInfo,
  WorkOsAuthProvider,
} from "../stubs/WorkOsAuthProvider";
import { Battery } from "../util/battery";
import { FileSearch } from "../util/FileSearch";
import { VsCodeIdeUtils } from "../util/ideUtils";
import { VsCodeIde } from "../VsCodeIde";

import { ConfigYamlDocumentLinkProvider } from "./ConfigYamlDocumentLinkProvider";
import { VsCodeMessenger } from "./VsCodeMessenger";

import { getAst } from "core/autocomplete/util/ast";
import { DocumentAstTracker } from "core/nextEdit/DocumentHistoryTracker";
import {
  EditableRegionStrategy,
  getNextEditableRegion,
} from "core/nextEdit/NextEditEditableRegionCalculator";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { localPathOrUriToPath } from "core/util/pathToUri";
import { JumpManager } from "../activation/JumpManager";
import setupNextEditWindowManager, {
  NextEditWindowManager,
} from "../activation/NextEditWindowManager";
import { GhostTextAcceptanceTracker } from "../autocomplete/GhostTextAcceptanceTracker";
import { getDefinitionsFromLsp } from "../autocomplete/lsp";
import { handleTextDocumentChange } from "../util/editLoggingUtils";
import type { VsCodeWebviewProtocol } from "../webviewProtocol";

export class VsCodeExtension {
  // Currently some of these are public so they can be used in testing (test/test-suites)

  private configHandler: ConfigHandler;
  private extensionContext: vscode.ExtensionContext;
  private ide: VsCodeIde;
  private ideUtils: VsCodeIdeUtils;
  private consoleView: ContinueConsoleWebviewViewProvider;
  private sidebar: ContinueGUIWebviewViewProvider;
  private windowId: string;
  private editDecorationManager: EditDecorationManager;
  private verticalDiffManager: VerticalDiffManager;
  webviewProtocolPromise: Promise<VsCodeWebviewProtocol>;
  private core: Core;
  private battery: Battery;
  private workOsAuthProvider: WorkOsAuthProvider;
  private fileSearch: FileSearch;
  private uriHandler = new UriEventHandler();
  private completionProvider: ContinueCompletionProvider;
  // Track whether the user is currently typing
  private isTypingSession = false;
  private typingTimer: NodeJS.Timeout | null = null;
  private lastDocumentChangeTime = 0;

  // Reset typing session after a delay
  resetTypingSession = () => {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.isTypingSession = false;
    }, 2000); // Typing session considered over after 2 seconds of inactivity
  };

  constructor(context: vscode.ExtensionContext) {
    // Register auth provider
    this.workOsAuthProvider = new WorkOsAuthProvider(context, this.uriHandler);
    void this.workOsAuthProvider.refreshSessions();
    context.subscriptions.push(this.workOsAuthProvider);

    this.editDecorationManager = new EditDecorationManager(context);

    let resolveWebviewProtocol: any = undefined;
    this.webviewProtocolPromise = new Promise<VsCodeWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );
    this.ide = new VsCodeIde(this.webviewProtocolPromise, context);
    this.ideUtils = new VsCodeIdeUtils();
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
      this.editDecorationManager,
      context,
      this,
    );

    this.core = new Core(inProcessMessenger, this.ide);
    this.configHandler = this.core.configHandler;
    resolveConfigHandler?.(this.configHandler);

    void this.configHandler.loadConfig();

    this.verticalDiffManager = new VerticalDiffManager(
      this.sidebar.webviewProtocol,
      this.editDecorationManager,
      this.ide,
    );
    resolveVerticalDiffManager?.(this.verticalDiffManager);

    void setupRemoteConfigSync(() =>
      this.configHandler.reloadConfig.bind(this.configHandler)(
        "Remote config sync",
      ),
    );

    void this.configHandler.loadConfig().then(({ config }) => {
      const { verticalDiffCodeLens } = registerAllCodeLensProviders(
        context,
        this.verticalDiffManager.fileUriToCodeLens,
        config,
      );

      this.verticalDiffManager.refreshCodeLens =
        verticalDiffCodeLens.refresh.bind(verticalDiffCodeLens);
    });

    this.configHandler.onConfigUpdate(
      async ({ config: newConfig, configLoadInterrupted }) => {
        if (newConfig?.experimental?.optInNextEditFeature) {
          // Set up next edit window manager only for Continue team members
          await setupNextEditWindowManager(context);

          this.activateNextEdit();
          await NextEditWindowManager.freeTabAndEsc();

          JumpManager.getInstance();
          GhostTextAcceptanceTracker.getInstance();
        } else {
          NextEditWindowManager.clearInstance();
          this.deactivateNextEdit();
          await NextEditWindowManager.freeTabAndEsc();

          JumpManager.clearInstance();
          GhostTextAcceptanceTracker.clearInstance();
        }

        if (configLoadInterrupted) {
          // Show error in status bar
          setupStatusBar(undefined, undefined, true);
        } else if (newConfig) {
          setupStatusBar(undefined, undefined, false);

          registerAllCodeLensProviders(
            context,
            this.verticalDiffManager.fileUriToCodeLens,
            newConfig,
          );
        }
      },
    );

    // Tab autocomplete
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = config.get<boolean>("enableTabAutocomplete");

    // Register inline completion provider
    setupStatusBar(
      enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    );
    this.completionProvider = new ContinueCompletionProvider(
      this.configHandler,
      this.ide,
      this.sidebar.webviewProtocol,
    );
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        this.completionProvider,
      ),
    );

    // Handle uri events
    this.uriHandler.event((uri) => {
      const queryParams = new URLSearchParams(uri.query);
      let profileId = queryParams.get("profile_id");
      let orgId = queryParams.get("org_id");

      this.core.invoke("config/refreshProfiles", {
        selectOrgId: orgId === "null" ? undefined : (orgId ?? undefined),
        selectProfileId:
          profileId === "null" ? undefined : (profileId ?? undefined),
      });
    });

    // Battery
    this.battery = new Battery();
    context.subscriptions.push(this.battery);
    context.subscriptions.push(monitorBatteryChanges(this.battery));

    // FileSearch
    this.fileSearch = new FileSearch(this.ide);
    registerAllPromptFilesCompletionProviders(
      context,
      this.fileSearch,
      this.ide,
    );

    const quickEdit = new QuickEdit(
      this.verticalDiffManager,
      this.configHandler,
      this.sidebar.webviewProtocol,
      this.ide,
      context,
      this.fileSearch,
    );

    // LLM Log view
    this.consoleView = new ContinueConsoleWebviewViewProvider(
      this.windowId,
      this.extensionContext,
      this.core.llmLogger,
    );

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "continue.continueConsoleView",
        this.consoleView,
      ),
    );

    // Commands
    registerAllCommands(
      context,
      this.ide,
      context,
      this.sidebar,
      this.consoleView,
      this.configHandler,
      this.verticalDiffManager,
      this.battery,
      quickEdit,
      this.core,
      this.editDecorationManager,
    );

    // Disabled due to performance issues
    // registerDebugTracker(this.sidebar.webviewProtocol, this.ide);

    // Listen for file saving - use global file watcher so that changes
    // from outside the window are also caught
    fs.watchFile(getConfigJsonPath(), { interval: 1000 }, async (stats) => {
      if (stats.size === 0) {
        return;
      }
      await this.configHandler.reloadConfig(
        "Global JSON config updated - fs file watch",
      );
    });

    fs.watchFile(
      getConfigYamlPath("vscode"),
      { interval: 1000 },
      async (stats) => {
        if (stats.size === 0) {
          return;
        }
        await this.configHandler.reloadConfig(
          "Global YAML config updated - fs file watch",
        );
      },
    );

    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      if (stats.size === 0) {
        return;
      }
      void this.configHandler.reloadConfig("config.ts updated - fs file watch");
    });

    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.contentChanges.length > 0) {
        this.isTypingSession = true;
        this.lastDocumentChangeTime = Date.now();
        this.resetTypingSession();
      }

      const editInfo = await handleTextDocumentChange(
        event,
        this.configHandler,
        this.ide,
        this.completionProvider,
        getDefinitionsFromLsp,
      );

      if (editInfo) this.core.invoke("files/smallEdit", editInfo);
    });

    vscode.workspace.onDidSaveTextDocument(async (event) => {
      this.core.invoke("files/changed", {
        uris: [event.uri.toString()],
      });
    });

    vscode.workspace.onDidDeleteFiles(async (event) => {
      this.core.invoke("files/deleted", {
        uris: event.files.map((uri) => uri.toString()),
      });
    });

    vscode.workspace.onDidCloseTextDocument(async (event) => {
      this.core.invoke("files/closed", {
        uris: [event.uri.toString()],
      });
    });

    vscode.workspace.onDidCreateFiles(async (event) => {
      this.core.invoke("files/created", {
        uris: event.files.map((uri) => uri.toString()),
      });
    });

    vscode.workspace.onDidOpenTextDocument(async (event) => {
      console.log("onDidOpenTextDocument");
      const ast = await getAst(event.fileName, event.getText());
      if (ast) {
        DocumentAstTracker.getInstance().addDocument(
          localPathOrUriToPath(event.fileName),
          event.getText(),
          ast,
        );
      }
    });

    // When GitHub sign-in status changes, reload config
    vscode.authentication.onDidChangeSessions(async (e) => {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      if (e.provider.id === env.AUTH_TYPE) {
        void vscode.commands.executeCommand(
          "setContext",
          "continue.isSignedInToControlPlane",
          true,
        );

        const sessionInfo = await getControlPlaneSessionInfo(true, false);
        void this.core.invoke("didChangeControlPlaneSessionInfo", {
          sessionInfo,
        });
      } else {
        void vscode.commands.executeCommand(
          "setContext",
          "continue.isSignedInToControlPlane",
          false,
        );

        if (e.provider.id === "github") {
          this.configHandler.reloadConfig("Github sign-in status changed");
        }
      }
    });

    // Listen for editor changes to clean up decorations when editor closes.
    vscode.window.onDidChangeVisibleTextEditors(async () => {
      // If our active editor is no longer visible, clear decorations.
      await NextEditProvider.getInstance().deleteChain();
    });

    // Listen for selection changes to hide tooltip when cursor moves.
    vscode.window.onDidChangeTextEditorSelection(async (e) => {
      // Don't delete the chain of edits if:

      // 1. A next edit window was just accepted.
      if (
        NextEditWindowManager.isInstantiated() &&
        NextEditWindowManager.getInstance().hasAccepted()
      ) {
        return;
      }

      // 2. A jump is in progress.
      if (JumpManager.getInstance().isJumpInProgress()) {
        return;
      }

      // 3. A ghost text was just accepted.
      // Check if this selection change matches our expected ghost text acceptance.
      const wasGhostTextAccepted =
        GhostTextAcceptanceTracker.getInstance().checkGhostTextWasAccepted(
          e.textEditor.document,
          e.selections[0].active,
        );

      if (wasGhostTextAccepted) {
        // Ghost text was accepted - don't delete the chain.
        return;
      }

      // 4. The selection change is part of a typing session
      // Check if this selection change is close enough to a document change to be considered typing.
      const timeSinceLastDocChange = Date.now() - this.lastDocumentChangeTime;
      const ARBITRARY_TYPING_DELAY = 500;
      if (
        this.isTypingSession &&
        timeSinceLastDocChange < ARBITRARY_TYPING_DELAY
      ) {
        // This selection change is likely due to typing, don't delete the chain.
        return;
      }

      // Otherwise, delete the chain (for rejection or unrelated movement).
      await NextEditProvider.getInstance().deleteChain();

      NextEditProvider.getInstance().loadNextEditableRegionsInTheCurrentChain(
        (await getNextEditableRegion(EditableRegionStrategy.Static, {
          cursorPosition: e.selections[0].anchor,
          filepath: localPathOrUriToPath(e.textEditor.document.uri.toString()),
          ide: this.ide,
        })) ?? [],
      );
    });

    // Refresh index when branch is changed
    void this.ide.getWorkspaceDirs().then((dirs) =>
      dirs.forEach(async (dir) => {
        const repo = await this.ide.getRepo(dir);
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
                  this.core.invoke("index/forceReIndex", { dirs: [dir] });
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

    const linkProvider = vscode.languages.registerDocumentLinkProvider(
      { language: "yaml" },
      new ConfigYamlDocumentLinkProvider(),
    );
    context.subscriptions.push(linkProvider);

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      void this.core.invoke("files/opened", { uris: [filepath] });
    });

    // initializes openedFileLruCache with files that are already open when the extension is activated
    let initialOpenedFilePaths = this.ideUtils
      .getOpenFiles()
      .map((uri) => uri.toString());
    this.core.invoke("files/opened", { uris: initialOpenedFilePaths });

    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(EXTENSION_NAME)) {
        const settings = await this.ide.getIdeSettings();
        void this.core.invoke("config/ideSettingsUpdate", settings);
      }
    });
  }

  static continueVirtualDocumentScheme = EXTENSION_NAME;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private PREVIOUS_BRANCH_FOR_WORKSPACE_DIR: { [dir: string]: string } = {};

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.configHandler.registerCustomContextProvider(contextProvider);
  }

  public activateNextEdit() {
    this.completionProvider.activateNextEdit();
  }

  public deactivateNextEdit() {
    this.completionProvider.deactivateNextEdit();
  }
}
