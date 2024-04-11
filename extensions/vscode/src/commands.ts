import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { IDE } from "core";
import { AutocompleteOutcome } from "core/autocomplete/completionProvider";
import { ConfigHandler } from "core/config/handler";
import { logDevData } from "core/util/devdata";
import { Telemetry } from "core/util/posthog";
import { ContinueGUIWebviewViewProvider } from "./debugPanel";
import { DiffManager } from "./diff/horizontal";
import { VerticalPerLineDiffManager } from "./diff/verticalPerLine/manager";
import { getPlatform } from "./util/util";
import { VsCodeWebviewProtocol } from "./webviewProtocol";

function getFullScreenTab() {
  const tabs = vscode.window.tabGroups.all.flatMap((tabGroup) => tabGroup.tabs);
  return tabs.find(
    (tab) => (tab.input as any)?.viewType?.endsWith("continue.continueGUIView"),
  );
}

function addHighlightedCodeToContext(
  edit: boolean,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (selection.isEmpty) return;
    const range = new vscode.Range(selection.start, selection.end);
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
    });
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
  });
}

// Copy everything over from extension.ts
const commandsMap: (
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
) => { [command: string]: (...args: any) => any } = (
  ide,
  extensionContext,
  sidebar,
  configHandler,
  diffManager,
  verticalDiffManager,
) => ({
  "continue.acceptDiff": async (newFilepath?: string | vscode.Uri) => {
    if (newFilepath instanceof vscode.Uri) {
      newFilepath = newFilepath.fsPath;
    }
    verticalDiffManager.clearForFilepath(newFilepath, true);
    await diffManager.acceptDiff(newFilepath);
  },
  "continue.rejectDiff": async (newFilepath?: string | vscode.Uri) => {
    if (newFilepath instanceof vscode.Uri) {
      newFilepath = newFilepath.fsPath;
    }
    verticalDiffManager.clearForFilepath(newFilepath, false);
    await diffManager.rejectDiff(newFilepath);
  },
  "continue.acceptVerticalDiffBlock": (filepath?: string, index?: number) => {
    verticalDiffManager.acceptRejectVerticalDiffBlock(true, filepath, index);
  },
  "continue.rejectVerticalDiffBlock": (filepath?: string, index?: number) => {
    verticalDiffManager.acceptRejectVerticalDiffBlock(false, filepath, index);
  },
  "continue.quickFix": async (message: string, code: string, edit: boolean) => {
    sidebar.webviewProtocol?.request("newSessionWithPrompt", {
      prompt: `${
        edit ? "/edit " : ""
      }${code}\n\nHow do I fix this problem in the above code?: ${message}`,
    });

    if (!edit) {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
    }
  },
  "continue.focusContinueInput": async () => {
    if (!getFullScreenTab()) {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
    }
    sidebar.webviewProtocol?.request("focusContinueInput", undefined);
    addHighlightedCodeToContext(false, sidebar.webviewProtocol);
  },
  "continue.focusContinueInputWithoutClear": async () => {
    if (!getFullScreenTab()) {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
    }
    sidebar.webviewProtocol?.request(
      "focusContinueInputWithoutClear",
      undefined,
    );
    addHighlightedCodeToContext(true, sidebar.webviewProtocol);
  },
  "continue.toggleAuxiliaryBar": () => {
    vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
  },
  "continue.quickEdit": async () => {
    const selectionEmpty = vscode.window.activeTextEditor?.selection.isEmpty;

    const editor = vscode.window.activeTextEditor;
    const existingHandler = verticalDiffManager.getHandlerForFile(
      editor?.document.uri.fsPath ?? "",
    );
    const previousInput = existingHandler?.input;

    let defaultModelTitle = await sidebar.webviewProtocol.request(
      "getDefaultModelTitle",
      undefined,
    );
    const config = await configHandler.loadConfig();
    if (!defaultModelTitle) {
      defaultModelTitle = config.models[0]?.title!;
    }
    const quickPickItems =
      config.contextProviders
        ?.filter((provider) => provider.description.type === "normal")
        .map((provider) => {
          return {
            label: provider.description.displayTitle,
            description: provider.description.title,
            detail: provider.description.description,
          };
        }) || [];

    const addContextMsg = quickPickItems.length
      ? " (or press enter to add context first)"
      : "";
    const textInputOptions: vscode.InputBoxOptions = {
      placeHolder: selectionEmpty
        ? `Type instructions to generate code${addContextMsg}`
        : `Describe how to edit the highlighted code${addContextMsg}`,
      title: `${getPlatform() === "mac" ? "Cmd" : "Ctrl"}+I`,
      prompt: `[${defaultModelTitle}]`,
    };
    if (previousInput) {
      textInputOptions.value = previousInput + ", ";
      textInputOptions.valueSelection = [
        textInputOptions.value.length,
        textInputOptions.value.length,
      ];
    }

    let text = await vscode.window.showInputBox(textInputOptions);

    if (text === undefined) {
      return;
    }

    if (text.length > 0 || quickPickItems.length === 0) {
      const modelName = await sidebar.webviewProtocol.request(
        "getDefaultModelTitle",
        undefined,
      );
      await verticalDiffManager.streamEdit(text, modelName);
    } else {
      // Pick context first
      const selectedProviders = await vscode.window.showQuickPick(
        quickPickItems,
        {
          title: "Add Context",
          canPickMany: true,
        },
      );

      let text = await vscode.window.showInputBox(textInputOptions);
      if (text) {
        const llm = await configHandler.llmFromTitle();
        const config = await configHandler.loadConfig();
        const context = (
          await Promise.all(
            selectedProviders?.map((providerTitle) => {
              const provider = config.contextProviders?.find(
                (provider) =>
                  provider.description.title === providerTitle.description,
              );
              if (!provider) {
                return [];
              }

              return provider.getContextItems("", {
                embeddingsProvider: config.embeddingsProvider,
                reranker: config.reranker,
                ide,
                llm,
                fullInput: text || "",
                selectedCode: [],
              });
            }) || [],
          )
        ).flat();

        text =
          context.map((item) => item.content).join("\n\n") +
          "\n\n---\n\n" +
          text;

        await verticalDiffManager.streamEdit(text, defaultModelTitle);
      }
    }
  },
  "continue.writeCommentsForCode": async () => {
    await verticalDiffManager.streamEdit(
      (await configHandler.loadConfig()).experimental?.contextMenuPrompts
        ?.comment ||
        "Write comments for this code. Do not change anything about the code itself.",
      await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined),
    );
  },
  "continue.writeDocstringForCode": async () => {
    await verticalDiffManager.streamEdit(
      (await configHandler.loadConfig()).experimental?.contextMenuPrompts
        ?.docstring ||
        "Write a docstring for this code. Do not change anything about the code itself.",
      await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined),
    );
  },
  "continue.fixCode": async () => {
    await verticalDiffManager.streamEdit(
      (await configHandler.loadConfig()).experimental?.contextMenuPrompts
        ?.fix || "Fix this code",
      await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined),
    );
  },
  "continue.optimizeCode": async () => {
    await verticalDiffManager.streamEdit(
      (await configHandler.loadConfig()).experimental?.contextMenuPrompts
        ?.optimize || "Optimize this code",
      await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined),
    );
  },
  "continue.fixGrammar": async () => {
    await verticalDiffManager.streamEdit(
      (await configHandler.loadConfig()).experimental?.contextMenuPrompts
        ?.fixGrammar ||
        "If there are any grammar or spelling mistakes in this writing, fix them. Do not make other large changes to the writing.",
      await sidebar.webviewProtocol.request("getDefaultModelTitle", undefined),
    );
  },
  "continue.viewLogs": async () => {
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
    const terminalContents = await ide.getTerminalContents();
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    sidebar.webviewProtocol?.request("userInput", {
      input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents.trim()}`,
    });
  },
  "continue.hideInlineTip": () => {
    vscode.workspace
      .getConfiguration("continue")
      .update("showInlineTip", false, vscode.ConfigurationTarget.Global);
  },

  // Commands without keyboard shortcuts
  "continue.addModel": () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    sidebar.webviewProtocol?.request("addModel", undefined);
  },
  "continue.openSettingsUI": () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    sidebar.webviewProtocol?.request("openSettings", undefined);
  },
  "continue.sendMainUserInput": (text: string) => {
    sidebar.webviewProtocol?.request("userInput", {
      input: text,
    });
  },
  "continue.shareSession": () => {
    sidebar.sendMainUserInput("/share");
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
    ide.runCommand(text);
  },
  "continue.newSession": () => {
    sidebar.webviewProtocol?.request("newSession", undefined);
  },
  "continue.viewHistory": () => {
    sidebar.webviewProtocol?.request("viewHistory", undefined);
  },
  "continue.toggleFullScreen": () => {
    // Check if full screen is already open by checking open tabs
    const fullScreenTab = getFullScreenTab();

    // Check if the active editor is the Continue GUI View
    if (fullScreenTab && fullScreenTab.isActive) {
      //Full screen open and focused - close it
      vscode.commands.executeCommand("workbench.action.closeActiveEditor"); //this will trigger the onDidDispose listener below
      return;
    }

    if (fullScreenTab) {
      //Full screen open, but not focused - focus it
      // Focus the tab
      const openOptions = {
        preserveFocus: true,
        preview: fullScreenTab.isPreview,
        viewColumn: fullScreenTab.group.viewColumn,
      };

      vscode.commands.executeCommand(
        "vscode.open",
        (fullScreenTab.input as any).uri,
        openOptions,
      );
      return;
    }

    //Full screen not open - open it

    // Close the sidebar.webviews
    // vscode.commands.executeCommand("workbench.action.closeSidebar");
    vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    // vscode.commands.executeCommand("workbench.action.toggleZenMode");

    //create the full screen panel
    let panel = vscode.window.createWebviewPanel(
      "continue.continueGUIView",
      "Continue",
      vscode.ViewColumn.One,
    );

    //Add content to the panel
    panel.webview.html = sidebar.getSidebarContent(
      extensionContext,
      panel,
      ide,
      configHandler,
      verticalDiffManager,
      undefined,
      undefined,
      true,
    );

    //When panel closes, reset the webview and focus
    panel.onDidDispose(
      () => {
        sidebar.resetWebviewProtocolWebview();
        vscode.commands.executeCommand("continue.focusContinueInput");
      },
      null,
      extensionContext.subscriptions,
    );
  },
  "continue.selectFilesAsContext": (
    firstUri: vscode.Uri,
    uris: vscode.Uri[],
  ) => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");

    for (const uri of uris) {
      addEntireFileToContext(uri, false, sidebar.webviewProtocol);
    }
  },
  "continue.updateAllReferences": (filepath: vscode.Uri) => {
    // Get the cursor position in the editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const position = editor.selection.active;
    sidebar.sendMainUserInput(
      `/references ${filepath.fsPath} ${position.line} ${position.character}`,
    );
  },
  "continue.logAutocompleteOutcome": (
    outcome: AutocompleteOutcome,
    logRejectionTimeout: NodeJS.Timeout,
  ) => {
    clearTimeout(logRejectionTimeout);
    outcome.accepted = true;
    logDevData("autocomplete", outcome);
    Telemetry.capture("autocomplete", {
      accepted: outcome.accepted,
      modelName: outcome.modelName,
      modelProvider: outcome.modelProvider,
      time: outcome.time,
      cacheHit: outcome.cacheHit,
    });
  },
  "continue.toggleTabAutocompleteEnabled": () => {
    const config = vscode.workspace.getConfiguration("continue");
    const enabled = config.get("enableTabAutocomplete");
    config.update(
      "enableTabAutocomplete",
      !enabled,
      vscode.ConfigurationTarget.Global,
    );
  },
});

export function registerAllCommands(
  context: vscode.ExtensionContext,
  ide: IDE,
  extensionContext: vscode.ExtensionContext,
  sidebar: ContinueGUIWebviewViewProvider,
  configHandler: ConfigHandler,
  diffManager: DiffManager,
  verticalDiffManager: VerticalPerLineDiffManager,
) {
  for (const [command, callback] of Object.entries(
    commandsMap(
      ide,
      extensionContext,
      sidebar,
      configHandler,
      diffManager,
      verticalDiffManager,
    ),
  )) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback),
    );
  }
}
