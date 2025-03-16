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
import { VsCodeIde } from "../VsCodeIde";

import { VsCodeMessenger } from "./VsCodeMessenger";

import type { VsCodeWebviewProtocol } from "../webviewProtocol";

export class VsCodeExtension {
  // Currently some of these are public so they can be used in testing (test/test-suites)

  private configHandler: ConfigHandler;
  private extensionContext: vscode.ExtensionContext;
  private ide: VsCodeIde;
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

  constructor(context: vscode.ExtensionContext) {
    // Register auth provider
    this.workOsAuthProvider = new WorkOsAuthProvider(context, this.uriHandler);
    this.workOsAuthProvider.refreshSessions();
    context.subscriptions.push(this.workOsAuthProvider);

    this.editDecorationManager = new EditDecorationManager(context);

    let resolveWebviewProtocol: any = undefined;
    this.webviewProtocolPromise = new Promise<VsCodeWebviewProtocol>(
      (resolve) => {
        resolveWebviewProtocol = resolve;
      },
    );
    this.ide = new VsCodeIde(this.webviewProtocolPromise, context);
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
      this.editDecorationManager,
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

    this.configHandler.loadConfig();
    this.verticalDiffManager = new VerticalDiffManager(
      this.configHandler,
      this.sidebar.webviewProtocol,
      this.editDecorationManager,
    );
    resolveVerticalDiffManager?.(this.verticalDiffManager);

    setupRemoteConfigSync(
      this.configHandler.reloadConfig.bind(this.configHandler),
    );

    this.configHandler.loadConfig().then(({ config }) => {
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
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        new ContinueCompletionProvider(
          this.configHandler,
          this.ide,
          this.sidebar.webviewProtocol,
        ),
      ),
    );

    // Handle uri events
    this.uriHandler.event((uri) => {
      const queryParams = new URLSearchParams(uri.query);
      let profileId = queryParams.get("profile_id");
      let orgId = queryParams.get("org_id");

      if (orgId) {
        if (orgId === "null") {
          orgId = null;
        }
        // In case org id is passed with profile id
        // Make sure org is updated before profile is set
        if (profileId) {
          if (profileId === "null") {
            profileId = null;
          }
          this.core.invoke("didChangeSelectedOrg", {
            id: orgId,
            profileId,
          });
        } else {
          this.core.invoke("didChangeSelectedOrg", {
            id: orgId,
          });
        }
      } else if (profileId) {
        if (profileId === "null") {
          profileId = null;
        }
        this.core.invoke("didChangeSelectedProfile", {
          id: profileId,
        });
      }
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

    // Commands
    registerAllCommands(
      context,
      this.ide,
      context,
      this.sidebar,
      this.configHandler,
      this.verticalDiffManager,
      this.core.continueServerClientPromise,
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
      await this.configHandler.reloadConfig();
    });

    fs.watchFile(
      getConfigYamlPath("vscode"),
      { interval: 1000 },
      async (stats) => {
        if (stats.size === 0) {
          return;
        }
        await this.configHandler.reloadConfig();
      },
    );

    fs.watchFile(getConfigTsPath(), { interval: 1000 }, (stats) => {
      if (stats.size === 0) {
        return;
      }
      this.configHandler.reloadConfig();
    });

    vscode.workspace.onDidSaveTextDocument(async (event) => {
      this.ide.updateLastFileSaveTimestamp();
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

    // When GitHub sign-in status changes, reload config
    vscode.authentication.onDidChangeSessions(async (e) => {
      const env = await getControlPlaneEnv(this.ide.getIdeSettings());
      if (e.provider.id === env.AUTH_TYPE) {
        vscode.commands.executeCommand(
          "setContext",
          "continue.isSignedInToControlPlane",
          true,
        );

        const sessionInfo = await getControlPlaneSessionInfo(true, false);
        this.webviewProtocolPromise.then(async (webviewProtocol) => {
          void webviewProtocol.request("didChangeControlPlaneSessionInfo", {
            sessionInfo,
          });

          // To make sure continue-proxy models and anything else requiring it get updated access token
          this.configHandler.reloadConfig();
        });
        void this.core.invoke("didChangeControlPlaneSessionInfo", {
          sessionInfo,
        });
      } else {
        vscode.commands.executeCommand(
          "setContext",
          "continue.isSignedInToControlPlane",
          false,
        );

        if (e.provider.id === "github") {
          this.configHandler.reloadConfig();
        }
      }
    });

    // Refresh index when branch is changed
    this.ide.getWorkspaceDirs().then((dirs) =>
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

    this.ide.onDidChangeActiveTextEditor((filepath) => {
      void this.core.invoke("didChangeActiveTextEditor", { filepath });
    });

    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration(EXTENSION_NAME)) {
        const settings = await this.ide.getIdeSettings();
        const webviewProtocol = await this.webviewProtocolPromise;
        void webviewProtocol.request("didChangeIdeSettings", {
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
