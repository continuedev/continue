/* eslint-disable @typescript-eslint/naming-convention */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ContextMenuConfig, RangeInFileWithContents } from "core";
import { CompletionProvider } from "core/autocomplete/CompletionProvider";
import { ConfigHandler } from "core/config/ConfigHandler";
import { getModelByRole } from "core/config/util";
import { ContinueServerClient } from "core/continueServer/stubs/client";
import { EXTENSION_NAME } from "core/control-plane/env";
import { Core } from "core/core";
import { walkDirAsync } from "core/indexing/walkDir";
import { GlobalContext } from "core/util/GlobalContext";
import { getConfigJsonPath, getDevDataFilePath } from "core/util/paths";
import { Telemetry } from "core/util/posthog";
import readLastLines from "read-last-lines";
import * as vscode from "vscode";

import {
  StatusBarStatus,
  getAutocompleteStatusBarDescription,
  getAutocompleteStatusBarTitle,
  getStatusBarStatus,
  getStatusBarStatusFromQuickPickItemLabel,
  quickPickStatusText,
  setupStatusBar,
} from "./autocomplete/statusBar";
import { ContinueGUIWebviewViewProvider } from "./ContinueGUIWebviewViewProvider";
import { DiffManager } from "./diff/horizontal";
import { VerticalDiffManager } from "./diff/vertical/manager";
import EditDecorationManager from "./quickEdit/EditDecorationManager";
import { QuickEdit, QuickEditShowParams } from "./quickEdit/QuickEditQuickPick";
import { Battery } from "./util/battery";
import { getFullyQualifiedPath } from "./util/util";
import { uriFromFilePath } from "./util/vscode";
import { VsCodeIde } from "./VsCodeIde";

import type { VsCodeWebviewProtocol } from "./webviewProtocol";

let fullScreenPanel: vscode.WebviewPanel | undefined;

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find((tab) =>
    (tab.input as any)?.viewType?.endsWith("continue.continueGUIView"),
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
  });
}

function getRangeInFileWithContents(
  allowEmpty?: boolean,
  range?: vscode.Range,
): RangeInFileWithContents | null {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const selection = editor.selection;
    const filepath = editor.document.uri.fsPath;

    if (range) {
      const contents = editor.document.getText(range);

      return {
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
        filepath,
        contents,
      };
    }

    if (selection.isEmpty && !allowEmpty) {
      return null;
    }

    // adjust starting position to include indentation
    const start = new vscode.Position(selection.start.line, 0);
    const selectionRange = new vscode.Range(start, selection.end);
    const contents = editor.document.getText(selectionRange);

    return {
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
  }

  return null;
}

async function addHighlightedCodeToContext(
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  const rangeInFileWithContents = getRangeInFileWithContents();
  if (rangeInFileWithContents) {
    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    });
  }
}

async function addEntireFileToContext(
  filepath: vscode.Uri,
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
  });
}

function focusGUI() {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab) {
    // focus fullscreen
    fullScreenPanel?.reveal();
  } else {
    // focus sidebar
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    // vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
  }
}

function hideGUI() {
  const fullScreenTab = getFullScreenTab();
  if (fullScreenTab) {
    // focus fullscreen
    fullScreenPanel?.dispose();
  } else {
    // focus sidebar
    vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    // vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
  }
}

async function processDiff(
  action: "accept" | "reject",
  sidebar: ContinueGUIWebviewViewProvider,
  diffManager: DiffManager,
  ide: VsCodeIde,
  verticalDiffManager: VerticalDiffManager,
  newFilepath?: string | vscode.Uri,
  streamId?: string,
) {
  captureCommandTelemetry(`${action}Diff`);

  let fullPath = newFilepath;

  if (fullPath instanceof vscode.Uri) {
    fullPath = fullPath.fsPath;
  } else if (fullPath) {
    fullPath = getFullyQualifiedPath(ide, fullPath);
  } else {
    const curFile = await ide.getCurrentFile();
    fullPath = curFile?.path;
  }

  if (!fullPath) {
    console.warn(
      `Unable to resolve filepath while attempting to resolve diff: ${newFilepath}`,
    );
    return;
  }

  await ide.openFile(fullPath);

  // Clear vertical diffs depending on action
  verticalDiffManager.clearForFilepath(fullPath, action === "accept");

  // Accept or reject the diff
  if (action === "accept") {
    await diffManager.acceptDiff(fullPath);
  } else {
    await diffManager.rejectDiff(fullPath);
  }

  void sidebar.webviewProtocol.request("setEditStatus", {
    status: "done",
  });

  if (streamId) {
    const fileContent = await ide.readFile(fullPath);

    await sidebar.webviewProtocol.request("updateApplyState", {
      fileContent,
      filepath: fullPath,
      streamId,
      status: "closed",
      numDiffs: 0,
    });
  }
}

function waitForSidebarReady(
  sidebar: ContinueGUIWebviewViewProvider,
  timeout: number,
  interval: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkReadyState = () => {
      if (sidebar.isReady) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        resolve(false); // Timed out
      } else {
        setTimeout(checkReadyState, interval);
      }
    };

    checkReadyState();
  });
}

// Copy everything over from extension.ts
const getCommandsMap: (
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
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
  editDecorationManager,
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

    const defaultModelTitle = await sidebar.webviewProtocol.request(
      "getDefaultModelTitle",
      undefined,
    );

    const modelTitle =
      getModelByRole(config, "inlineEdit")?.title ?? defaultModelTitle;

    void sidebar.webviewProtocol.request("incrementFtc", undefined);

    await verticalDiffManager.streamEdit(
      config.experimental?.contextMenuPrompts?.[promptName] ?? fallbackPrompt,
      modelTitle,
      undefined,
      onlyOneInsertion,
      undefined,
      range,
    );
  }
  return {
    "continue.acceptDiff": async (
      newFilepath?: string | vscode.Uri,
      streamId?: string,
    ) =>
      processDiff(
        "accept",
        sidebar,
        diffManager,
        ide,
        verticalDiffManager,
        newFilepath,
        streamId,
      ),

    "continue.rejectDiff": async (
      newFilepath?: string | vscode.Uri,
      streamId?: string,
    ) =>
      processDiff(
        "reject",
        sidebar,
        diffManager,
        ide,
        verticalDiffManager,
        newFilepath,
        streamId,
      ),
    "continue.acceptVerticalDiffBlock": (filepath?: string, index?: number) => {
      captureCommandTelemetry("acceptVerticalDiffBlock");
      verticalDiffManager.acceptRejectVerticalDiffBlock(true, filepath, index);
    },
    "continue.rejectVerticalDiffBlock": (filepath?: string, index?: number) => {
      captureCommandTelemetry("rejectVerticalDiffBlock");
      verticalDiffManager.acceptRejectVerticalDiffBlock(false, filepath, index);
    },
    "continue.quickFix": async (
      range: vscode.Range,
      diagnosticMessage: string,
    ) => {
      captureCommandTelemetry("quickFix");

      const prompt = `Please explain the cause of this error and how to solve it: ${diagnosticMessage}`;

      addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

      vscode.commands.executeCommand("continue.continueGUIView.focus");
    },
    // Passthrough for telemetry purposes
    "continue.defaultQuickAction": async (args: QuickEditShowParams) => {
      captureCommandTelemetry("defaultQuickAction");
      vscode.commands.executeCommand("continue.focusEdit", args);
    },
    "continue.customQuickActionSendToChat": async (
      prompt: string,
      range: vscode.Range,
    ) => {
      captureCommandTelemetry("customQuickActionSendToChat");

      addCodeToContextFromRange(range, sidebar.webviewProtocol, prompt);

      vscode.commands.executeCommand("continue.continueGUIView.focus");
    },
    "continue.customQuickActionStreamInlineEdit": async (
      prompt: string,
      range: vscode.Range,
    ) => {
      captureCommandTelemetry("customQuickActionStreamInlineEdit");

      streamInlineEdit("docstring", prompt, false, range);
    },
    "continue.codebaseForceReIndex": async () => {
      core.invoke("index/forceReIndex", undefined);
    },
    "continue.rebuildCodebaseIndex": async () => {
      core.invoke("index/forceReIndex", { shouldClearIndexes: true });
    },
    "continue.docsIndex": async () => {
      core.invoke("context/indexDocs", { reIndex: false });
    },
    "continue.docsReIndex": async () => {
      core.invoke("context/indexDocs", { reIndex: true });
    },
    "continue.focusContinueInput": async () => {
      // This is a temporary fix—sidebar.webviewProtocol.request is blocking
      // when the GUI hasn't yet been setup and we should instead be
      // immediately throwing an error, or returning a Result object
      focusGUI();
      if (!sidebar.isReady) {
        const isReady = await waitForSidebarReady(sidebar, 5000, 100);
        if (!isReady) {
          return;
        }
      }

      const historyLength = await sidebar.webviewProtocol.request(
        "getWebviewHistoryLength",
        undefined,
        false,
      );
      const isContinueInputFocused = await sidebar.webviewProtocol.request(
        "isContinueInputFocused",
        undefined,
        false,
      );

      if (isContinueInputFocused) {
        if (historyLength === 0) {
          hideGUI();
        } else {
          void sidebar.webviewProtocol?.request(
            "focusContinueInputWithNewSession",
            undefined,
            false,
          );
        }
      } else {
        focusGUI();
        sidebar.webviewProtocol?.request(
          "focusContinueInputWithNewSession",
          undefined,
          false,
        );
        void addHighlightedCodeToContext(sidebar.webviewProtocol);
      }
    },
    "continue.focusContinueInputWithoutClear": async () => {
      // This is a temporary fix—sidebar.webviewProtocol.request is blocking
      // when the GUI hasn't yet been setup and we should instead be
      // immediately throwing an error, or returning a Result object
      if (!sidebar.isReady) {
        focusGUI();
        return;
      }

      const isContinueInputFocused = await sidebar.webviewProtocol.request(
        "isContinueInputFocused",
        undefined,
      );

      if (isContinueInputFocused) {
        hideGUI();
      } else {
        focusGUI();

        sidebar.webviewProtocol?.request(
          "focusContinueInputWithoutClear",
          undefined,
        );

        void addHighlightedCodeToContext(sidebar.webviewProtocol);
      }
    },
    // QuickEditShowParams are passed from CodeLens, temp fix
    // until we update to new params specific to Edit
    "continue.focusEdit": async (args?: QuickEditShowParams) => {
      captureCommandTelemetry("focusEdit");
      focusGUI();

      sidebar.webviewProtocol?.request("focusEdit", undefined);

      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const existingDiff = verticalDiffManager.getHandlerForFile(
        editor.document.fileName,
      );

      // If there's a diff currently being applied, then we just toggle focus back to the input
      if (existingDiff) {
        sidebar.webviewProtocol?.request("focusContinueInput", undefined);
        return;
      }

      const range =
        args?.range ??
        new vscode.Range(editor.selection.start, editor.selection.end);

      editDecorationManager.setDecoration(editor, range);

      const rangeInFileWithContents = getRangeInFileWithContents(true, range);

      if (rangeInFileWithContents) {
        sidebar.webviewProtocol?.request(
          "addCodeToEdit",
          rangeInFileWithContents,
        );

        // Un-select the current selection
        editor.selection = new vscode.Selection(
          editor.selection.anchor,
          editor.selection.anchor,
        );
      }
    },
    "continue.focusEditWithoutClear": async () => {
      captureCommandTelemetry("focusEditWithoutClear");
      focusGUI();

      sidebar.webviewProtocol?.request("focusEditWithoutClear", undefined);

      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const document = editor.document;

      const existingDiff = verticalDiffManager.getHandlerForFile(
        document.fileName,
      );

      // If there's a diff currently being applied, then we just toggle focus back to the input
      if (existingDiff) {
        sidebar.webviewProtocol?.request("focusContinueInput", undefined);
        return;
      }

      const rangeInFileWithContents = getRangeInFileWithContents(false);

      if (rangeInFileWithContents) {
        sidebar.webviewProtocol?.request(
          "addCodeToEdit",
          rangeInFileWithContents,
        );
      } else {
        const filepath = document.uri.fsPath;
        const contents = document.getText();

        sidebar.webviewProtocol?.request("addCodeToEdit", {
          filepath,
          contents,
        });
      }
    },
    "continue.exitEditMode": async () => {
      captureCommandTelemetry("exitEditMode");
      editDecorationManager.clear();
      void sidebar.webviewProtocol?.request("exitEditMode", undefined);
    },
    // "continue.quickEdit": async (args: QuickEditShowParams) => {
    //   let linesOfCode = undefined;
    //   if (args.range) {
    //     linesOfCode = args.range.end.line - args.range.start.line;
    //   }
    //   captureCommandTelemetry("quickEdit", {
    //     linesOfCode,
    //   });
    //   quickEdit.show(args);
    // },
    "continue.writeCommentsForCode": async () => {
      captureCommandTelemetry("writeCommentsForCode");

      streamInlineEdit(
        "comment",
        "Write comments for this code. Do not change anything about the code itself.",
      );
    },
    "continue.writeDocstringForCode": async () => {
      captureCommandTelemetry("writeDocstringForCode");

      streamInlineEdit(
        "docstring",
        "Write a docstring for this code. Do not change anything about the code itself.",
        true,
      );
    },
    "continue.fixCode": async () => {
      captureCommandTelemetry("fixCode");

      streamInlineEdit(
        "fix",
        "Fix this code. If it is already 100% correct, simply rewrite the code.",
      );
    },
    "continue.optimizeCode": async () => {
      captureCommandTelemetry("optimizeCode");
      streamInlineEdit("optimize", "Optimize this code");
    },
    "continue.fixGrammar": async () => {
      captureCommandTelemetry("fixGrammar");
      streamInlineEdit(
        "fixGrammar",
        "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
      );
    },
    "continue.viewLogs": async () => {
      captureCommandTelemetry("viewLogs");

      // Open ~/.continue/continue.log
      const logFile = path.join(os.homedir(), ".continue", "continue.log");
      // Make sure the file/directory exist
      if (!fs.existsSync(logFile)) {
        fs.mkdirSync(path.dirname(logFile), { recursive: true });
        fs.writeFileSync(logFile, "");
      }

      const uri = vscode.Uri.file(logFile);
      await vscode.window.showTextDocument(uri);
    },
    "continue.debugTerminal": async () => {
      captureCommandTelemetry("debugTerminal");

      const terminalContents = await ide.getTerminalContents();

      vscode.commands.executeCommand("continue.continueGUIView.focus");

      sidebar.webviewProtocol?.request("userInput", {
        input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
      });
    },
    "continue.hideInlineTip": () => {
      vscode.workspace
        .getConfiguration(EXTENSION_NAME)
        .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
    },

    // Commands without keyboard shortcuts
    "continue.addModel": () => {
      captureCommandTelemetry("addModel");

      vscode.commands.executeCommand("continue.continueGUIView.focus");
      sidebar.webviewProtocol?.request("addModel", undefined);
    },
    "continue.sendMainUserInput": (text: string) => {
      sidebar.webviewProtocol?.request("userInput", {
        input: text,
      });
    },
    "continue.selectRange": (startLine: number, endLine: number) => {
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
    "continue.foldAndUnfold": (
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
    "continue.sendToTerminal": (text: string) => {
      captureCommandTelemetry("sendToTerminal");
      ide.runCommand(text);
    },
    "continue.newSession": () => {
      sidebar.webviewProtocol?.request("newSession", undefined);
    },
    "continue.viewHistory": () => {
      sidebar.webviewProtocol?.request("viewHistory", undefined);
    },
    "continue.focusContinueSessionId": async (
      sessionId: string | undefined,
    ) => {
      if (!sessionId) {
        sessionId = await vscode.window.showInputBox({
          prompt: "Enter the Session ID",
        });
      }
      void sidebar.webviewProtocol?.request("focusContinueSessionId", {
        sessionId,
      });
    },
    "continue.applyCodeFromChat": () => {
      void sidebar.webviewProtocol.request("applyCodeFromChat", undefined);
    },
    "continue.toggleFullScreen": async () => {
      focusGUI();

      const sessionId = await sidebar.webviewProtocol.request("getCurrentSessionId", undefined);
      // Check if full screen is already open by checking open tabs
      const fullScreenTab = getFullScreenTab();

      if (fullScreenTab && fullScreenPanel) {
        // Full screen open, but not focused - focus it
        fullScreenPanel.reveal();
        vscode.commands.executeCommand("continue.focusContinueInput");
        return;
      }

      // Full screen not open - open it
      captureCommandTelemetry("openFullScreen");

      // Create the full screen panel
      let panel = vscode.window.createWebviewPanel(
        "continue.continueGUIView",
        "Continue",
        vscode.ViewColumn.One,
        {
          retainContextWhenHidden: true,
          enableScripts: true,
        },
      );
      fullScreenPanel = panel;

      // Add content to the panel
      panel.webview.html = sidebar.getSidebarContent(
        extensionContext,
        panel,
        undefined,
        undefined,
        true,
      );
      
      panel.onDidChangeViewState(() => {
        vscode.commands.executeCommand("continue.newSession");
        if(sessionId){
          vscode.commands.executeCommand("continue.focusContinueSessionId", sessionId);
        }
      });

      // When panel closes, reset the webview and focus
      panel.onDidDispose(
        () => {
          sidebar.resetWebviewProtocolWebview();
          vscode.commands.executeCommand("continue.focusContinueInput");
        },
        null,
        extensionContext.subscriptions,
      );

      vscode.commands.executeCommand("workbench.action.copyEditorToNewWindow");
      vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    },
    "continue.openConfig": () => {
      core.invoke("config/openProfile", {
        profileId: undefined,
      });
    },
    "continue.selectFilesAsContext": async (
      firstUri: vscode.Uri,
      uris: vscode.Uri[],
    ) => {
      if (uris === undefined) {
        throw new Error("No files were selected");
      }

      vscode.commands.executeCommand("continue.continueGUIView.focus");

      for (const uri of uris) {
        // If it's a folder, add the entire folder contents recursively by using walkDir (to ignore ignored files)
        const isDirectory = await vscode.workspace.fs
          .stat(uri)
          ?.then((stat) => stat.type === vscode.FileType.Directory);
        if (isDirectory) {
          for await (const filepath of walkDirAsync(uri.fsPath, ide)) {
            addEntireFileToContext(
              uriFromFilePath(filepath),
              sidebar.webviewProtocol,
            );
          }
        } else {
          addEntireFileToContext(uri, sidebar.webviewProtocol);
        }
      }
    },
    "continue.logAutocompleteOutcome": (
      completionId: string,
      completionProvider: CompletionProvider,
    ) => {
      completionProvider.accept(completionId);
    },
    "continue.toggleTabAutocompleteEnabled": () => {
      captureCommandTelemetry("toggleTabAutocompleteEnabled");

      const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
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
    "continue.openTabAutocompleteConfigMenu": async () => {
      captureCommandTelemetry("openTabAutocompleteConfigMenu");

      const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
      const quickPick = vscode.window.createQuickPick();
      const autocompleteModels =
        (await configHandler.loadConfig())?.tabAutocompleteModels ?? [];

      let selected = new GlobalContext().get("selectedTabAutocompleteModel");
      if (
        !selected ||
        !autocompleteModels.some((model) => model.title === selected)
      ) {
        selected = autocompleteModels[0]?.title;
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
          label: "$(question) Open help center",
        },
        {
          label: "$(comment) Open chat (Cmd+L)",
        },
        {
          label: "$(screen-full) Open full screen chat (Cmd+K Cmd+M)",
        },
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
        ...autocompleteModels.map((model) => ({
          label: getAutocompleteStatusBarTitle(selected, model),
          description: getAutocompleteStatusBarDescription(selected, model),
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
        } else if (
          autocompleteModels.some((model) => model.title === selectedOption)
        ) {
          new GlobalContext().update(
            "selectedTabAutocompleteModel",
            selectedOption,
          );
          configHandler.reloadConfig();
        } else if (selectedOption === "$(feedback) Give feedback") {
          vscode.commands.executeCommand("continue.giveAutocompleteFeedback");
        } else if (selectedOption === "$(comment) Open chat (Cmd+L)") {
          vscode.commands.executeCommand("continue.focusContinueInput");
        } else if (
          selectedOption ===
          "$(screen-full) Open full screen chat (Cmd+K Cmd+M)"
        ) {
          vscode.commands.executeCommand("continue.toggleFullScreen");
        } else if (selectedOption === "$(question) Open help center") {
          focusGUI();
          vscode.commands.executeCommand("continue.navigateTo", "/more", true);
        }
        quickPick.dispose();
      });
      quickPick.show();
    },
    "continue.giveAutocompleteFeedback": async () => {
      const feedback = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        prompt:
          "Please share what went wrong with the last completion. The details of the completion as well as this message will be sent to the Continue team in order to improve.",
      });
      if (feedback) {
        const client = await continueServerClientPromise;
        const completionsPath = getDevDataFilePath("autocomplete");

        const lastLines = await readLastLines.read(completionsPath, 2);
        client.sendFeedback(feedback, lastLines);
      }
    },
    "continue.openMorePage": () => {
      vscode.commands.executeCommand("continue.navigateTo", "/more", true);
    },
    "continue.navigateTo": (path: string, toggle: boolean) => {
      sidebar.webviewProtocol?.request("navigateTo", { path, toggle });
      focusGUI();
    },
    "continue.signInToControlPlane": () => {
      sidebar.webviewProtocol?.request("signInToControlPlane", undefined);
    },
    "continue.openAccountDialog": () => {
      sidebar.webviewProtocol?.request("openDialogMessage", "account");
    },
  };
};

const registerCopyBufferSpy = (context: vscode.ExtensionContext) => {
  const typeDisposable = vscode.commands.registerCommand(
    "editor.action.clipboardCopyAction",
    async (arg) => doCopy(typeDisposable),
  );

  async function doCopy(typeDisposable: any) {
    typeDisposable.dispose(); // must dispose to avoid endless loops

    await vscode.commands.executeCommand("editor.action.clipboardCopyAction");

    const clipboardText = await vscode.env.clipboard.readText();

    await context.workspaceState.update("continue.copyBuffer", {
      text: clipboardText,
      copiedAt: new Date().toISOString(),
    });

    // re-register to continue intercepting copy commands
    typeDisposable = vscode.commands.registerCommand(
      "editor.action.clipboardCopyAction",
      async () => doCopy(typeDisposable),
    );
    context.subscriptions.push(typeDisposable);
  }

  context.subscriptions.push(typeDisposable);
};

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: VsCodeIde,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalDiffManager,
  continueServerClientPromise: Promise<ContinueServerClient>,
  battery: Battery,
  quickEdit: QuickEdit,
  core: Core,
  editDecorationManager: EditDecorationManager,
) {
  registerCopyBufferSpy(context);

  for (const [command, callback] of Object.entries(
    getCommandsMap(
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
      editDecorationManager,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}
