import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

import { ideProtocolClient } from "./activation/activate";
import { debugPanelWebview, getSidebarContent } from "./debugPanel";
import { acceptDiffCommand, rejectDiffCommand } from "./diff/horizontal";
import {
  editorToVerticalDiffCodeLens,
  streamEdit,
  verticalPerLineDiffManager,
} from "./diff/verticalPerLine/manager";

function addHighlightedCodeToContext(edit: boolean) {
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

    debugPanelWebview?.postMessage({
      type: "highlightedCode",
      rangeInFileWithContents,
      edit,
    });
  }
}

async function addEntireFileToContext(filepath: vscode.Uri, edit: boolean) {
  // If a directory, add all files in the directory
  const stat = await vscode.workspace.fs.stat(filepath);
  if (stat.type === vscode.FileType.Directory) {
    const files = await vscode.workspace.fs.readDirectory(filepath);
    for (const [filename, type] of files) {
      if (type === vscode.FileType.File) {
        addEntireFileToContext(vscode.Uri.joinPath(filepath, filename), edit);
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

  debugPanelWebview?.postMessage({
    type: "highlightedCode",
    rangeInFileWithContents,
    edit,
  });
}

function acceptRejectVerticalDiffBlock(
  accept: boolean,
  filepath?: string,
  index?: number
) {
  if (!filepath) {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }
    filepath = activeEditor.document.uri.fsPath;
  }

  if (typeof index === "undefined") {
    index = 0;
  }

  let blocks = editorToVerticalDiffCodeLens.get(filepath);
  const block = blocks?.[index];
  if (!blocks || !block) {
    return;
  }

  const handler = verticalPerLineDiffManager.getHandlerForFile(filepath);
  if (!handler) {
    return;
  }

  // CodeLens object removed from editorToVerticalDiffCodeLens here
  handler.acceptRejectBlock(accept, block.start, block.numGreen, block.numRed);
}

// Copy everything over from extension.ts
const commandsMap: { [command: string]: (...args: any) => any } = {
  "continue.acceptDiff": acceptDiffCommand,
  "continue.rejectDiff": rejectDiffCommand,
  "continue.acceptVerticalDiffBlock": (filepath?: string, index?: number) => {
    acceptRejectVerticalDiffBlock(true, filepath, index);
  },
  "continue.rejectVerticalDiffBlock": (filepath?: string, index?: number) => {
    acceptRejectVerticalDiffBlock(false, filepath, index);
  },
  "continue.quickFix": async (message: string, code: string, edit: boolean) => {
    ideProtocolClient.sendMainUserInput(
      `${
        edit ? "/edit " : ""
      }${code}\n\nHow do I fix this problem in the above code?: ${message}`
    );
    if (!edit) {
      vscode.commands.executeCommand("continue.continueGUIView.focus");
    }
  },
  "continue.focusContinueInput": async () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    debugPanelWebview?.postMessage({
      type: "focusContinueInput",
    });
    addHighlightedCodeToContext(false);
  },
  "continue.focusContinueInputWithoutClear": async () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    debugPanelWebview?.postMessage({
      type: "focusContinueInputWithoutClear",
    });
    addHighlightedCodeToContext(true);
  },
  "continue.toggleAuxiliaryBar": () => {
    vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
  },
  "continue.quickEdit": async () => {
    const text = await vscode.window.showInputBox({
      placeHolder: "Describe how to edit the highlighted code",
      title: "Continue Quick Edit",
    });
    if (text) {
      await streamEdit(text);
    }
  },
  "continue.writeCommentsForCode": async () => {
    await streamEdit("Write comments for this code");
  },
  "continue.writeDocstringForCode": async () => {
    await streamEdit("Write a docstring for this code");
  },
  "continue.fixCode": async () => {
    await streamEdit("Fix this code");
  },
  "continue.optimizeCode": async () => {
    await streamEdit("Optimize this code");
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
    const terminalContents = await ideProtocolClient.getTerminalContents(2);
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    debugPanelWebview?.postMessage({
      type: "userInput",
      input: `I got the following error, can you please help explain how to fix it?\n\n${terminalContents}`,
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
    debugPanelWebview?.postMessage({
      type: "addModel",
    });
  },
  "continue.openSettingsUI": () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    debugPanelWebview?.postMessage({
      type: "openSettings",
    });
  },
  "continue.sendMainUserInput": (text: string) => {
    ideProtocolClient.sendMainUserInput(text);
  },
  "continue.shareSession": () => {
    ideProtocolClient.sendMainUserInput("/share");
  },
  "continue.selectRange": (startLine: number, endLine: number) => {
    if (!vscode.window.activeTextEditor) {
      return;
    }
    vscode.window.activeTextEditor.selection = new vscode.Selection(
      startLine,
      0,
      endLine,
      0
    );
  },
  "continue.foldAndUnfold": (
    foldSelectionLines: number[],
    unfoldSelectionLines: number[]
  ) => {
    vscode.commands.executeCommand("editor.unfold", {
      selectionLines: unfoldSelectionLines,
    });
    vscode.commands.executeCommand("editor.fold", {
      selectionLines: foldSelectionLines,
    });
  },
  "continue.sendToTerminal": (text: string) => {
    ideProtocolClient.runCommand(text);
  },
  "continue.newSession": () => {
    debugPanelWebview?.postMessage({
      type: "newSession",
    });
  },
  "continue.viewHistory": () => {
    debugPanelWebview?.postMessage({
      type: "viewHistory",
    });
  },
  "continue.toggleFullScreen": () => {
    // Check if full screen is already open by checking open tabs
    const tabs = vscode.window.tabGroups.all.flatMap(
      (tabGroup) => tabGroup.tabs
    );

    const fullScreenTab = tabs.find(
      (tab) => (tab.input as any).viewType?.endsWith("continue.continueGUIView")
    );

    // Check if the active editor is the Continue GUI View
    if (fullScreenTab && fullScreenTab.isActive) {
      vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      vscode.commands.executeCommand("continue.focusContinueInput");
      return;
    }

    if (fullScreenTab) {
      // Focus the tab
      const openOptions = {
        preserveFocus: true,
        preview: fullScreenTab.isPreview,
        viewColumn: fullScreenTab.group.viewColumn,
      };

      vscode.commands.executeCommand(
        "vscode.open",
        (fullScreenTab.input as any).uri,
        openOptions
      );
      return;
    }

    // Close the sidebars
    // vscode.commands.executeCommand("workbench.action.closeSidebar");
    vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    // vscode.commands.executeCommand("workbench.action.toggleZenMode");
    const panel = vscode.window.createWebviewPanel(
      "continue.continueGUIView",
      "Continue",
      vscode.ViewColumn.One
    );
    panel.webview.html = getSidebarContent(panel, undefined, undefined, true);
  },
  "continue.selectFilesAsContext": (
    firstUri: vscode.Uri,
    uris: vscode.Uri[]
  ) => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");

    for (const uri of uris) {
      addEntireFileToContext(uri, false);
    }
  },
  "continue.updateAllReferences": (filepath: vscode.Uri) => {
    // Get the cursor position in the editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const position = editor.selection.active;
    ideProtocolClient.sendMainUserInput(
      `/references ${filepath.fsPath} ${position.line} ${position.character}`
    );
  },
};

export function registerAllCommands(context: vscode.ExtensionContext) {
  for (const [command, callback] of Object.entries(commandsMap)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  }
}
