import fs from "fs";

import { ConfigHandler } from "core/config/ConfigHandler";
import { modelSupportsNextEdit } from "core/llm/autodetect";
import { LLMLogger } from "core/llm/logger";
import { NextEditProvider } from "core/nextEdit/NextEditProvider";
import { EXTENSION_NAME } from "core/util/constants";
import { getConfigYamlPath } from "core/util/paths";
import * as vscode from "vscode";

import setupNextEditWindowManager, {
  NextEditWindowManager,
} from "../activation/NextEditWindowManager";
import {
  HandlerPriority,
  SelectionChangeManager,
} from "../activation/SelectionChangeManager";
import { ContinueCompletionProvider } from "../autocomplete/completionProvider";
import { GhostTextAcceptanceTracker } from "../autocomplete/GhostTextAcceptanceTracker";
import { setupStatusBar, StatusBarStatus } from "../autocomplete/statusBar";
import {
  clearDocumentContentCache,
  handleTextDocumentChange,
  initDocumentContentCache,
} from "../util/editLoggingUtils";
import { VsCodeIde } from "../VsCodeIde";

export class VsCodeExtension {
  private readonly configHandler: ConfigHandler;
  private readonly ide: VsCodeIde;
  private readonly completionProvider: ContinueCompletionProvider;
  private readonly typingDelay = 2000;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.ide = new VsCodeIde(
      new Promise<import("../webviewProtocol").VsCodeWebviewProtocol>(() => {}),
      context,
    );
    this.configHandler = new ConfigHandler(this.ide, new LLMLogger());
    this.completionProvider = new ContinueCompletionProvider(
      this.configHandler,
      this.ide,
      undefined as never,
      true,
    );

    const selectionManager = SelectionChangeManager.getInstance();
    selectionManager.initialize(this.ide, true);
    selectionManager.registerListener(
      "typing",
      async (_, state) =>
        state.isTypingSession &&
        Date.now() - state.lastDocumentChangeTime < this.typingDelay &&
        (!NextEditWindowManager.isInstantiated() ||
          !NextEditWindowManager.getInstance().hasAccepted()),
      HandlerPriority.NORMAL,
    );

    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider(
        [{ pattern: "**" }],
        this.completionProvider,
      ),
      vscode.commands.registerCommand(
        "continue.toggleNextEditEnabled",
        async () => {
          const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
          const enabled = config.get<boolean>("enableNextEdit") ?? false;
          await config.update(
            "enableNextEdit",
            !enabled,
            vscode.ConfigurationTarget.Global,
          );
        },
      ),
      vscode.commands.registerCommand(
        "continue.forceNextEdit",
        () => vscode.commands.executeCommand("editor.action.inlineSuggest.trigger"),
      ),
      vscode.window.onDidChangeTextEditorSelection((event) =>
        selectionManager.handleSelectionChange(event),
      ),
      vscode.window.onDidChangeVisibleTextEditors(() =>
        NextEditProvider.getInstance().deleteChain(),
      ),
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (event.contentChanges.length > 0) {
          selectionManager.documentChanged();
        }
        await handleTextDocumentChange(
          event,
          this.configHandler,
          this.ide,
          this.completionProvider,
          async () => [],
        );
      }),
      vscode.workspace.onDidCloseTextDocument((document) =>
        clearDocumentContentCache(document.uri.toString()),
      ),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(`${EXTENSION_NAME}.enableNextEdit`)) {
          return this.updateNextEditState();
        }
      }),
    );

    for (const document of vscode.workspace.textDocuments) {
      initDocumentContentCache(document);
    }
    context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument(initDocumentContentCache),
    );

    fs.watchFile(getConfigYamlPath("vscode"), { interval: 1000 }, (stats) => {
      if (stats.size > 0) {
        void this.configHandler.reloadConfig("Configuration file updated");
      }
    });
    context.subscriptions.push({
      dispose: () => fs.unwatchFile(getConfigYamlPath("vscode")),
    });

    this.configHandler.onConfigUpdate(() => void this.updateNextEditState());
    void this.configHandler.loadConfig().then(() => this.updateNextEditState());
  }

  private async updateNextEditState(): Promise<void> {
    const { config } = await this.configHandler.loadConfig();
    const model = config?.selectedModelByRole.autocomplete;
    const supportsNextEdit =
      model &&
      modelSupportsNextEdit(model.capabilities, model.model, model.title);
    const settings = vscode.workspace.getConfiguration(EXTENSION_NAME);
    const enabled = settings.get<boolean>("enableNextEdit") ?? false;

    setupStatusBar(
      enabled ? StatusBarStatus.Enabled : StatusBarStatus.Disabled,
    );

    if (enabled && supportsNextEdit) {
      await setupNextEditWindowManager(this.context);
      this.completionProvider.activateNextEdit();
      await NextEditWindowManager.freeTabAndEsc();
      GhostTextAcceptanceTracker.getInstance().registerSelectionChangeHandler();
      NextEditWindowManager.getInstance().registerSelectionChangeHandler();
    } else {
      this.completionProvider.deactivateNextEdit();
      NextEditWindowManager.clearInstance();
      GhostTextAcceptanceTracker.clearInstance();
    }
  }
}
