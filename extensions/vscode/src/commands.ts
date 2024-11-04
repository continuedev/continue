/* Note: This file has been modified significantly from its original contents. New commands have been added, and there has been renaming from Continue to PearAI. pearai-submodule is a fork of Continue (https://github.com/continuedev/continue)." */

/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { ContextMenuConfig, IDE } from "core";
import { CompletionProvider } from "core/autocomplete/completionProvider";
import { ConfigHandler } from "core/config/ConfigHandler";
import { ContinueServerClient } from "core/continueServer/stubs/client";
import { Core } from "core/core";
import { GlobalContext } from "core/util/GlobalContext";
import { getConfigJsonPath, getDevDataFilePath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import readLastLines from "read-last-lines";
import {
  StatusBarStatus,
  getStatusBarStatus,
  getStatusBarStatusFromQuickPickItemLabel,
  quickPickStatusText,
  setupStatusBar,
} from "./autocomplete/statusBar";
import { ContinueGUIWebviewViewProvider, PEAR_OVERLAY_VIEW_ID } from "./ContinueGUIWebviewViewProvider";
import { DiffManager } from "./diff/horizontal";
import { VerticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { QuickEdit, QuickEditShowParams } from "./quickEdit/QuickEditQuickPick";
import { Battery } from "./util/battery";
import type { VsCodeWebviewProtocol } from "./webviewProtocol";
import { getExtensionUri } from "./util/vscode";
import { aiderCtrlC, aiderResetSession, openAiderPanel, refreshAiderProcessState } from './integrations/aider/aider';
import { handlePerplexityMode } from "./integrations/perplexity/perplexity";
import { PEAR_CONTINUE_VIEW_ID } from "./ContinueGUIWebviewViewProvider";
import { handleIntegrationShortcutKey } from "./util/integrationUtils";
import { FIRST_LAUNCH_KEY, importUserSettingsFromVSCode, isFirstLaunch } from "./copySettings";


let fullScreenPanel: vscode.WebviewPanel | undefined;

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find((tab) =>
    (tab.input as any)?.viewType?.endsWith("pearai.pearAIChatView"),
  );
}


type TelemetryCaptureParams = Parameters<typeof Telemetry.capture>;

/**
 * Helper method to add the `isCommandEvent` to all telemetry captures
 */
function captureCommandTelemetry(
  commandName: TelemetryCaptureParams[0],
  properties: TelemetryCaptureParams[1] = {},
) {
  Telemetry.capture(commandName, { isCommandEvent: true, ...properties });
}

function addCodeToContextFromRange(
  range: vscode.Range,
  webviewProtocol: VsCodeWebviewProtocol,
  prompt?: string,
) {
  const document = vscode.window.activeTextEditor?.document;

  if (!document) {
    return;
  }

  const rangeInFileWithContents = {
    filepath: document.uri.fsPath,
    contents: document.getText(range),
    range: {
      start: {
        line: range.start.line,
        character: range.start.character,
      },
      end: {
        line: range.end.line,
        character: range.end.character,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
    prompt,
    // Assume `true` since range selection is currently only used for quick actions/fixes
    shouldRun: true,
  }, ["pearai.pearAIChatView"]);
}

async function addHighlightedCodeToContext(
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (selection.isEmpty) {
      return;
    }
    // adjust starting position to include indentation
    const start = new vscode.Position(selection.start.line, 0);
    const range = new vscode.Range(start, selection.end);
    const contents = editor.document.getText(range);
    const rangeInFileWithContents = {
      filepath: editor.document.uri.fsPath,
      contents,
      range: {
        start: {
          line: selection.start.line,
          character: selection.start.character,
        },
        end: {
          line: selection.end.line,
          character: selection.end.character,
        },
      },
    };

    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    }, ["pearai.pearAIChatView"]);
  }
}

async function addEntireFileToContext(
  filepath: vscode.Uri,
  edit: boolean,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  // If a directory, add all files in the directory
  const stat = await vscode.workspace.fs.stat(filepath);
  if (stat.type === vscode.FileType.Directory) {
    const files = await vscode.workspace.fs.readDirectory(filepath);
    for (const [filename, type] of files) {
      if (type === vscode.FileType.File) {
        addEntireFileToContext(
          vscode.Uri.joinPath(filepath, filename),
          edit,
          webviewProtocol,
        );
      }
    }
    return;
  }

  // Get the contents of the file
  const contents = (await vscode.workspace.fs.readFile(filepath)).toString();
  const rangeInFileWithContents = {
    filepath: filepath.fsPath,
    contents: contents,
    range: {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: contents.split(os.EOL).length - 1,
        character: 0,
      },
    },
  };

  webviewProtocol?.request("highlightedCode", {
    rangeInFileWithContents,
  }, ["pearai.pearAIChatView"]);
}

// Copy everything over from extension.ts
const commandsMap: (
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
) => { [command: string]: (...args: any) => any } = (
  ide,
  extensionContext,
  sidebar,
  configHandler,
  diffManager,
  verticalDiffManager,
  continueServerClientPromise,
  battery,
  quickEdit,
  core,
) => {
  /**
   * Streams an inline edit to the vertical diff manager.
   *
   * This function retrieves the configuration, determines the appropriate model title,
   * increments the FTC count, and then streams an edit to the
   * vertical diff manager.
   *
   * @param  promptName - The key for the prompt in the context menu configuration.
   * @param  fallbackPrompt - The prompt to use if the configured prompt is not available.
   * @param  [onlyOneInsertion] - Optional. If true, only one insertion will be made.
   * @param  [range] - Optional. The range to edit if provided.
   * @returns
   */
  async function streamInlineEdit(
    promptName: keyof ContextMenuConfig,
    fallbackPrompt: string,
    onlyOneInsertion?: boolean,
    range?: vscode.Range,
  ) {
    const config = await configHandler.loadConfig();

    const modelTitle =
      config.experimental?.modelRoles?.inlineEdit ??
      (await sidebar.webviewProtocol.request(
        "getDefaultModelTitle",
        undefined,
      ));

    sidebar.webviewProtocol.request("incrementFtc", undefined);

    await verticalDiffManager.streamEdit(
      config.experimental?.contextMenuPrompts?.[promptName] ?? fallbackPrompt,
      modelTitle,
      onlyOneInsertion,
      undefined,
      range,
    );
  }

  return {
    "pearai.openPearAiWelcome": async () => {
      vscode.commands.executeCommand(
        "markdown.showPreview",
        vscode.Uri.file(
          path.join(getExtensionUri().fsPath, "media", "welcome.md"),
        ),
      );
    },
    "pearai.welcome.importUserSettingsFromVSCode": async () => {
      if (!isFirstLaunch(extensionContext)) {
        vscode.window.showInformationMessage("Welcome back! User settings import is skipped as this is not the first launch.");
        console.dir("Extension launch detected as a subsequent launch. Skipping user settings import.");
        return;
      }
      importUserSettingsFromVSCode();
    },
    "pearai.welcome.markNewOnboardingComplete": async () => {
      vscode.window.showInformationMessage("Marking New onboarding complete");
      await extensionContext.globalState.update(FIRST_LAUNCH_KEY, true);
    },
    "pearai.showInteractiveContinueTutorial": async () => {
      sidebar.webviewProtocol?.request("showInteractiveContinueTutorial", undefined, [PEAR_CONTINUE_VIEW_ID]);
    },
    "pearai.acceptDiff": async (newFilepath?: string | vscode.Uri) => {
      captureCommandTelemetry("acceptDiff");

      if (newFilepath instanceof vscode.Uri) {
        newFilepath = newFilepath.fsPath;
      }
      verticalDiffManager.clearForFilepath(newFilepath, true);
      await diffManager.acceptDiff(newFilepath);
    },
    "pearai.rejectDiff": async (newFilepath?: string | vscode.Uri) => {
      captureCommandTelemetry("rejectDiff");

      if (newFilepath instanceof vscode.Uri) {
        newFilepath = newFilepath.fsPath;
      }
      verticalDiffManager.clearForFilepath(newFilepath, false);
      await diffManager.rejectDiff(newFilepath);
    },
    "pearai.acceptVerticalDiffBlock": (filepath?: string, index?: number) => {
      captureCommandTelemetry("acceptVerticalDiffBlock");
      verticalDiffManager.acceptRejectVerticalDiffBlock(true, filepath, index);
    },
    "pearai.rejectVerticalDiffBlock": (filepath?: string, index?: number) => {
      captureCommandTelemetry("rejectVerticalDiffBlock");
      verticalDiffManager.acceptRejectVerticalDiffBlock(false, filepath, index);
    },
    "pearai.quickFix": async (
      range: vscode.Range,
      diagnosticMessage: string,
    ) => {
      captureCommandTelemetry("quickFix");

      const prompt = `How do I fix the following problem in the above code?: ${diagnosticMessage}`;

      addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

      vscode.commands.executeCommand("pearai.focusContinueInput");
    },
    // Passthrough for telemetry purposes
    "pearai.defaultQuickAction": async (args: QuickEditShowParams) => {
      captureCommandTelemetry("defaultQuickAction");
      vscode.commands.executeCommand("pearai.quickEdit", args);
    },
    "pearai.customQuickActionSendToChat": async (
      prompt: string,
      range: vscode.Range,
    ) => {
      captureCommandTelemetry("customQuickActionSendToChat");

      addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

      vscode.commands.executeCommand("pearai.pearAIChatView.focus");
    },
    "pearai.customQuickActionStreamInlineEdit": async (
      prompt: string,
      range: vscode.Range,
    ) => {
      captureCommandTelemetry("customQuickActionStreamInlineEdit");

      streamInlineEdit("docstring", prompt, false, range);
    },
    "pearai.toggleAuxiliaryBar": () => {
      vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
    },
    "pearai.codebaseForceReIndex": async () => {
      core.invoke("index/forceReIndex", undefined);
    },
    "pearai.docsIndex": async () => {
      core.invoke("context/indexDocs", { reIndex: false });
    },
    "pearai.docsReIndex": async () => {
      core.invoke("context/indexDocs", { reIndex: true });
    },
    "pearai.toggleCreator": async () => {
      await handleIntegrationShortcutKey("navigateToCreator", "aiderMode", sidebar, PEAR_OVERLAY_VIEW_ID)
    },
    "pearai.toggleSearch": async () => {
      await handleIntegrationShortcutKey("navigateToSearch", "perplexityMode", sidebar, PEAR_OVERLAY_VIEW_ID)
    },
    "pearai.toggleInventory": async () => {
      await handleIntegrationShortcutKey("navigateToInventory", "inventory", sidebar, PEAR_OVERLAY_VIEW_ID)
    },
    "pearai.startOnboarding": async () => {
      await vscode.commands.executeCommand("pearai.showOverlay");
    },
    "pearai.developer.restFirstLaunch": async () => {
      extensionContext.globalState.update(FIRST_LAUNCH_KEY, false);
      vscode.window.showInformationMessage("Successfully reset PearAI first launch flag, RELOAD WINDOW TO SEE WELCOME PAGE", 'Reload Window')
        .then(selection => {
          if (selection === 'Reload Window') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
      console.log("FIRST PEARAI LAUNCH FLAG RESET");
    },
    "pearai.focusContinueInput": async () => {
      const fullScreenTab = getFullScreenTab();
      if (!fullScreenTab) {
        // focus sidebar
        vscode.commands.executeCommand("pearai.pearAIChatView.focus");
      } else {
        // focus fullscreen
        fullScreenPanel?.reveal();
      }
      sidebar.webviewProtocol?.request("focusContinueInput", undefined, ["pearai.pearAIChatView"]);
      await addHighlightedCodeToContext(sidebar.webviewProtocol);
    },
    "pearai.focusContinueInputWithoutClear": async () => {
      const fullScreenTab = getFullScreenTab();

      const isContinueInputFocused = await sidebar.webviewProtocol.request(
        "isContinueInputFocused",
        undefined,
      );

      if (isContinueInputFocused) {
        // Handle closing the GUI only if we are focused on the input
        if (fullScreenTab) {
          fullScreenPanel?.dispose();
        } else {
          vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
        }
      } else {
        // Handle opening the GUI otherwise
        if (!fullScreenTab) {
          // focus sidebar
          vscode.commands.executeCommand("pearai.pearAIChatView.focus");
        } else {
          // focus fullscreen
          fullScreenPanel?.reveal();
        }

        sidebar.webviewProtocol?.request(
          "focusContinueInputWithoutClear",
          undefined,
        );

        await addHighlightedCodeToContext(sidebar.webviewProtocol);
      }
    },
    "pearai.quickEdit": async (args: QuickEditShowParams) => {
      captureCommandTelemetry("quickEdit");
      quickEdit.show(args);
      sidebar.webviewProtocol?.request("quickEdit", undefined, [PEAR_CONTINUE_VIEW_ID]);
    },
    "pearai.writeCommentsForCode": async () => {
      captureCommandTelemetry("writeCommentsForCode");

      streamInlineEdit(
        "comment",
        "Write comments for this code. Do not change anything about the code itself.",
      );
    },
    "pearai.writeDocstringForCode": async () => {
      captureCommandTelemetry("writeDocstringForCode");

      streamInlineEdit(
        "docstring",
        "Write a docstring for this code. Do not change anything about the code itself.",
        true,
      );
    },
    "pearai.fixCode": async () => {
      captureCommandTelemetry("fixCode");

      streamInlineEdit(
        "fix",
        "Fix this code. If it is already 100% correct, simply rewrite the code.",
      );
    },
    "pearai.optimizeCode": async () => {
      captureCommandTelemetry("optimizeCode");
      streamInlineEdit("optimize", "Optimize this code");
    },
    "pearai.fixGrammar": async () => {
      captureCommandTelemetry("fixGrammar");
      streamInlineEdit(
        "fixGrammar",
        "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
      );
    },
    "pearai.viewLogs": async () => {
      captureCommandTelemetry("viewLogs");

      // Open ~/.pearai/pearai.log
      const logFile = path.join(os.homedir(), ".pearai", "pearai.log");
      // Make sure the file/directory exist
      if (!fs.existsSync(logFile)) {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, "");
      }

      const uri = vscode.Uri.file(logFile);
      await vscode.window.showTextDocument(uri);
    },
    "pearai.debugTerminal": async () => {
      captureCommandTelemetry("debugTerminal");

      const terminalContents = await ide.getTerminalContents();

      vscode.commands.executeCommand("pearai.pearAIChatView.focus");

      sidebar.webviewProtocol?.request("userInput", {
        input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
      }, ["pearai.pearAIChatView"]);
    },
    "pearai.hideInlineTip": () => {
      vscode.workspace
        .getConfiguration("pearai")
        .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
    },

    // Commands without keyboard shortcuts
    "pearai.addModel": () => {
      captureCommandTelemetry("addModel");

      vscode.commands.executeCommand("pearai.pearAIChatView.focus");
      sidebar.webviewProtocol?.request("addModel", undefined, ["pearai.pearAIChatView"]);
    },
    "pearai.openSettingsUI": () => {
      vscode.commands.executeCommand("pearai.pearAIChatView.focus");
      sidebar.webviewProtocol?.request("openSettings", undefined, ["pearai.pearAIChatView"]);
    },
    "pearai.sendMainUserInput": (text: string) => {
      sidebar.webviewProtocol?.request("userInput", {
        input: text,
      });
    },
    "pearai.selectRange": (startLine: number, endLine: number) => {
      if (!vscode.window.activeTextEditor) {
        return;
      }
      vscode.window.activeTextEditor.selection = new vscode.Selection(
        startLine,
        0,
        endLine,
        0,
      );
    },
    "pearai.foldAndUnfold": (
      foldSelectionLines: number[],
      unfoldSelectionLines: number[],
    ) => {
      vscode.commands.executeCommand("editor.unfold", {
        selectionLines: unfoldSelectionLines,
      });
      vscode.commands.executeCommand("editor.fold", {
        selectionLines: foldSelectionLines,
      });
    },
    "pearai.sendToTerminal": (text: string) => {
      captureCommandTelemetry("sendToTerminal");
      ide.runCommand(text);
    },
    "pearai.newSession": () => {
      sidebar.webviewProtocol?.request("newSession", undefined);
    },
    "pearai.viewHistory": () => {
      sidebar.webviewProtocol?.request("viewHistory", undefined, [
        "pearai.pearAIChatView",
      ]);
    },
    "pearai.toggleFullScreen": () => {
      // Check if full screen is already open by checking open tabs
      const fullScreenTab = getFullScreenTab();

      // Check if the active editor is the Continue GUI View
      if (fullScreenTab && fullScreenTab.isActive) {
        //Full screen open and focused - close it
        vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
        return;
      }

      if (fullScreenTab && fullScreenPanel) {
        //Full screen open, but not focused - focus it
        fullScreenPanel.reveal();
        return;
      }

      //Full screen not open - open it
      captureCommandTelemetry("openFullScreen");

      // Close the sidebar.webviews
      // vscode.commands.executeCommand("workbench.action.closeSidebar");
      vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
      // vscode.commands.executeCommand("workbench.action.toggleZenMode");

      //create the full screen panel
      let panel = vscode.window.createWebviewPanel(
        "pearai.pearAIChatViewFullscreen",
        "PearAI",
        vscode.ViewColumn.One,
        {
          retainContextWhenHidden: true,
        },
      );
      fullScreenPanel = panel;

      //Add content to the panel
      panel.webview.html = sidebar.getSidebarContent(
        extensionContext,
        panel,
        undefined,
        undefined,
        true,
      );

      //When panel closes, reset the webview and focus
      panel.onDidDispose(
        () => {
          sidebar.resetWebviewProtocolWebview();
          vscode.commands.executeCommand("pearai.focusContinueInput");
        },
        null,
        extensionContext.subscriptions,
      );
    },
    "pearai.aiderMode": async () => {
      //await openAiderPanel(core, sidebar, extensionContext);
      await handleIntegrationShortcutKey("navigateToCreator", "aiderMode", sidebar, PEAR_OVERLAY_VIEW_ID)
    },
    "pearai.aiderCtrlC": async () => {
      await aiderCtrlC(core);
    },
    "pearai.aiderResetSession": async () => {
      await aiderResetSession(core);
    },
    "pearai.refreshAiderProcessState": async () => {
      await refreshAiderProcessState(core);
    },
    "pearai.perplexityMode": async () => {
      // handlePerplexityMode(sidebar, extensionContext);
      await handleIntegrationShortcutKey("navigateToSearch", "perplexityMode", sidebar, PEAR_OVERLAY_VIEW_ID)
    },
    "pearai.addPerplexityContext": (msg) => {
      const fullScreenTab = getFullScreenTab();
      if (!fullScreenTab) {
        // focus sidebar
        vscode.commands.executeCommand("pearai.pearAIChatView.focus");
      }
      sidebar.webviewProtocol?.request("addPerplexityContextinChat", msg.data, ["pearai.pearAIChatView"]);
    },
    "pearai.openConfigJson": () => {
      ide.openFile(getConfigJsonPath());
    },
    "pearai.selectFilesAsContext": (
      firstUri: vscode.Uri,
      uris: vscode.Uri[],
    ) => {
      vscode.commands.executeCommand("pearai.pearAIChatView.focus");

      for (const uri of uris) {
        addEntireFileToContext(uri, false, sidebar.webviewProtocol);
      }
    },
    "pearai.logAutocompleteOutcome": (
      completionId: string,
      completionProvider: CompletionProvider,
    ) => {
      completionProvider.accept(completionId);
    },
    "pearai.toggleTabAutocompleteEnabled": () => {
      captureCommandTelemetry("toggleTabAutocompleteEnabled");

      const config = vscode.workspace.getConfiguration("pearai");
      const enabled = config.get("enableTabAutocomplete");
      const pauseOnBattery = config.get<boolean>(
        "pauseTabAutocompleteOnBattery",
      );
      if (!pauseOnBattery || battery.isACConnected()) {
        config.update(
          "enableTabAutocomplete",
          !enabled,
          vscode.ConfigurationTarget.Global,
        );
      } else {
        if (enabled) {
          const paused = getStatusBarStatus() === StatusBarStatus.Paused;
          if (paused) {
            setupStatusBar(StatusBarStatus.Enabled);
          } else {
            config.update(
              "enableTabAutocomplete",
              false,
              vscode.ConfigurationTarget.Global,
            );
          }
        } else {
          setupStatusBar(StatusBarStatus.Paused);
          config.update(
            "enableTabAutocomplete",
            true,
            vscode.ConfigurationTarget.Global,
          );
        }
      }
    },
    "pearai.openTabAutocompleteConfigMenu": async () => {
      captureCommandTelemetry("openTabAutocompleteConfigMenu");

      const config = vscode.workspace.getConfiguration("pearai");
      const quickPick = vscode.window.createQuickPick();
      const autocompleteModels =
        (await configHandler.loadConfig())?.tabAutocompleteModels ?? [];
      const autocompleteModelTitles = autocompleteModels
        .map((model) => model.title)
        .filter((t) => t !== undefined) as string[];
      let selected = new GlobalContext().get("selectedTabAutocompleteModel");
      if (
        !selected ||
        !autocompleteModelTitles.some((title) => title === selected)
      ) {
        selected = autocompleteModelTitles[0];
      }

      // Toggle between Disabled, Paused, and Enabled
      const pauseOnBattery =
        config.get<boolean>("pauseTabAutocompleteOnBattery") &&
        !battery.isACConnected();
      const currentStatus = getStatusBarStatus();

      let targetStatus: StatusBarStatus | undefined;
      if (pauseOnBattery) {
        // Cycle from Disabled -> Paused -> Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Paused
            ? StatusBarStatus.Enabled
            : currentStatus === StatusBarStatus.Disabled
              ? StatusBarStatus.Paused
              : StatusBarStatus.Disabled;
      } else {
        // Toggle between Disabled and Enabled
        targetStatus =
          currentStatus === StatusBarStatus.Disabled
            ? StatusBarStatus.Enabled
            : StatusBarStatus.Disabled;
      }
      quickPick.items = [
        {
          label: quickPickStatusText(targetStatus),
        },
        {
          label: "$(gear) Configure autocomplete options",
        },
        {
          label: "$(feedback) Give feedback",
        },
        {
          kind: vscode.QuickPickItemKind.Separator,
          label: "Switch model",
        },
        ...autocompleteModelTitles.map((title) => ({
          label: title === selected ? `$(check) ${title}` : title,
          description: title === selected ? "Currently selected" : undefined,
        })),
      ];
      quickPick.onDidAccept(() => {
        const selectedOption = quickPick.selectedItems[0].label;
        const targetStatus =
          getStatusBarStatusFromQuickPickItemLabel(selectedOption);

        if (targetStatus !== undefined) {
          setupStatusBar(targetStatus);
          config.update(
            "enableTabAutocomplete",
            targetStatus === StatusBarStatus.Enabled,
            vscode.ConfigurationTarget.Global,
          );
        } else if (
          selectedOption === "$(gear) Configure autocomplete options"
        ) {
          ide.openFile(getConfigJsonPath());
        } else if (autocompleteModelTitles.includes(selectedOption)) {
          new GlobalContext().update(
            "selectedTabAutocompleteModel",
            selectedOption,
          );
          configHandler.reloadConfig();
        } else if (selectedOption === "$(feedback) Give feedback") {
          vscode.commands.executeCommand("pearai.giveAutocompleteFeedback");
        }
        quickPick.dispose();
      });
      quickPick.show();
    },
    "pearai.giveAutocompleteFeedback": async () => {
      const feedback = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt:
          "Please share what went wrong with the last completion. The details of the completion as well as this message will be sent to PearAI in order to improve.",
      });
      if (feedback) {
        const client = await continueServerClientPromise;
        const completionsPath = getDevDataFilePath("autocomplete");

        const lastLines = await readLastLines.read(completionsPath, 2);
        client.sendFeedback(feedback, lastLines);
      }
    },
    "pearai.debug2": async () => {
      const extensionUrl = `${vscode.env.uriScheme}://pearai.pearai/auth?token=TOKEN&refresh=REFRESH`;
      const extensionUrlParsed = vscode.Uri.parse(extensionUrl);
      const callbackUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(extensionUrl),
      );

      vscode.window.showInformationMessage(`${callbackUri.toString(true)}`);

      const creds = await vscode.commands.executeCommand("pearai.getPearAuth");
      console.log("auth:", creds);
    },
    "pearai.getPearAuth": async () => {
      // TODO: This may need some work, for now we dont have vscode ExtensionContext access in the ideProtocol.ts so this will do
      const accessToken = await extensionContext.secrets.get("pearai-token");
      const refreshToken = await extensionContext.secrets.get("pearai-refresh");

      const creds = {
        accessToken: accessToken ? accessToken.toString() : null,
        refreshToken: refreshToken ? refreshToken.toString() : null,
      };

      return creds;
    },
    "pearai.login": async () => {
      const extensionUrl = `${vscode.env.uriScheme}://pearai.pearai/auth`;
      const callbackUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(extensionUrl),
      );

      // TODO: Open the proxy location with vscode redirect
      await vscode.env.openExternal(
        await vscode.env.asExternalUri(
          vscode.Uri.parse(
            `https://trypear.ai/signin?callback=${callbackUri.toString()}`, // Change to localhost if running locally
          ),
        ),
      );
    },
    "pearai.logout": async () => {
      await extensionContext.secrets.delete("pearai-token");
      await extensionContext.secrets.delete("pearai-refresh");
      core.invoke("llm/setPearAICredentials", { accessToken: undefined, refreshToken: undefined });
      vscode.window.showInformationMessage("PearAI: Successfully logged out!");
    },
    "pearai.updateUserAuth": async (data: {
      accessToken: string;
      refreshToken: string;
    }) => {
      // Ensure that refreshToken and accessToken are both present
      if (!data || !(data.refreshToken && data.accessToken)) {
        vscode.window.showWarningMessage(
          "PearAI: Failed to parse user auth request!",
        );
        return;
      }

      extensionContext.secrets.store("pearai-token", data.accessToken);
      extensionContext.secrets.store("pearai-refresh", data.refreshToken);
      core.invoke("llm/setPearAICredentials", { accessToken: data.accessToken, refreshToken: data.refreshToken });
      sidebar.webviewProtocol?.request("pearAISignedIn", undefined);
      vscode.window.showInformationMessage("PearAI: Successfully logged in!");
      core.invoke("llm/startAiderProcess", undefined);
      if (isFirstLaunch(extensionContext)) {
        vscode.commands.executeCommand("pearai.welcome.markNewOnboardingComplete");
      }
    },
    "pearai.closeChat": () => {
      vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
    },
    "pearai.loadRecentChat": () => {
      sidebar.webviewProtocol?.request("loadMostRecentChat", undefined, ["pearai.pearAIChatView"]);
      sidebar.webviewProtocol?.request("focusContinueInput", undefined, ["pearai.pearAIChatView"]);
    },
    "pearai.resizeAuxiliaryBarWidth": () => {
      vscode.commands.executeCommand(
        "workbench.action.resizeAuxiliaryBarWidth",
      );
    },
    "pearai.winshortcutResizeAuxiliaryBarWidth": () => {
      vscode.commands.executeCommand("pearai.resizeAuxiliaryBarWidth");
    },
    "pearai.macResizeAuxiliaryBarWidth": () => {
      vscode.commands.executeCommand("pearai.resizeAuxiliaryBarWidth");
    },
    "pearai.patchWSL": async () => {
      if (process.platform !== 'win32') {
        vscode.window.showWarningMessage("WSL is for Windows only.");
        return;
      }

      const wslExtension = vscode.extensions.getExtension('ms-vscode-remote.remote-wsl');

      if (!wslExtension) {
        vscode.window.showInformationMessage("Please install WSL extension first, then try again.");
        return;
      }

      const wslExtensionPath = wslExtension.extensionPath;
      const pearExtensionPath = extensionContext.extensionPath;
      const wslDownloadScript = path.join( wslExtensionPath, "scripts", "wslDownload.sh" );
      const patchScript = path.join(pearExtensionPath, "wsl-scripts/wslPatch.sh");

      if (!fs.existsSync(patchScript)) {
        vscode.window.showWarningMessage("Patch script not found.");
        return;
      }

      let PEAR_COMMIT_ID = "";
      let VSC_COMMIT_ID = "";
      const productJsonPath = path.join(vscode.env.appRoot, "product.json");
      try {
        const productJson = JSON.parse(
          fs.readFileSync(productJsonPath, "utf8"),
        );
        PEAR_COMMIT_ID = productJson.commit;
        VSC_COMMIT_ID = productJson.VSCodeCommit;
        // testing commit ids - its for VSC version 1.89 most probably.
        // VSC_COMMIT_ID = "4849ca9bdf9666755eb463db297b69e5385090e3";
        // PEAR_COMMIT_ID="58996b5e761a7fe74bdfb4ac468e4b91d4d27294";
        vscode.window.showInformationMessage(`VSC commit: ${VSC_COMMIT_ID}`);
      } catch (error) {
        vscode.window.showErrorMessage("Error reading product.json");
        console.error("Error reading product.json:", error);
      }

      if (!PEAR_COMMIT_ID) {
        vscode.window.showWarningMessage(
          "Unable to retrieve PEAR commit ID.",
        );
        return;
      }

      if (!VSC_COMMIT_ID) {
        vscode.window.showWarningMessage(
          "Unable to retrieve VSCODE commit ID.",
        );
        return;
      }

      vscode.window.showInformationMessage(`Downloading WSL`);

      let terminal: vscode.Terminal;

      try {
        terminal = vscode.window.createTerminal({
          name: "WSL Patch",
          shellPath: "wsl.exe"
        });
      } catch (error) {
        vscode.window.showErrorMessage("WSL is not installed. Please install WSL and try again.");
        return;
      }

      terminal.sendText(`$(wslpath '${patchScript}') $(wslpath '${wslDownloadScript}') '${PEAR_COMMIT_ID}' '${VSC_COMMIT_ID}'`);
      terminal.show();
    },
  };
};

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
) {
  for (const [command, callback] of Object.entries(
    commandsMap(
      ide,
      extensionContext,
      sidebar,
      configHandler,
      diffManager,
      verticalDiffManager,
      continueServerClientPromise,
      battery,
      quickEdit,
      core,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}
