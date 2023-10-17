import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

import { acceptDiffCommand, rejectDiffCommand } from "./diffs";
import { debugPanelWebview } from "./debugPanel";
import { ideProtocolClient } from "./activation/activate";

let focusedOnContinueInput = false;

function addHighlightedCodeToContext(edit: boolean) {
  focusedOnContinueInput = !focusedOnContinueInput;
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (selection.isEmpty) return;
    const range = new vscode.Range(selection.start, selection.end);
    const contents = editor.document.getText(range);
    ideProtocolClient?.sendHighlightedCode(
      [
        {
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
        },
      ],
      edit
    );
  }
}

export const setFocusedOnContinueInput = (value: boolean) => {
  focusedOnContinueInput = value;
};

// Copy everything over from extension.ts
const commandsMap: { [command: string]: (...args: any) => any } = {
  "continue.acceptDiff": acceptDiffCommand,
  "continue.rejectDiff": rejectDiffCommand,
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
  "continue.focusContinueInputWithEdit": async () => {
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    addHighlightedCodeToContext(true);
    debugPanelWebview?.postMessage({
      type: "focusContinueInputWithEdit",
    });
    focusedOnContinueInput = true;
  },
  "continue.toggleAuxiliaryBar": () => {
    vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
  },
  "continue.quickTextEntry": async () => {
    addHighlightedCodeToContext(true);
    const text = await vscode.window.showInputBox({
      placeHolder: "Ask a question or enter a slash command",
      title: "Continue Quick Input",
    });
    if (text) {
      ideProtocolClient.sendMainUserInput(text);
    }
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
    vscode.commands.executeCommand("continue.continueGUIView.focus");
    await ideProtocolClient.debugTerminal();
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
};

export function registerAllCommands(context: vscode.ExtensionContext) {
  for (const [command, callback] of Object.entries(commandsMap)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  }
}
