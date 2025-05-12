import * as vscode from "vscode";
import { VerticalDiffManager } from "../diff/vertical/manager";
import { getRangeInFileWithContents } from "../util/addCode";
import { VsCodeWebviewProtocol } from "../webviewProtocol";
import EditDecorationManager from "./EditDecorationManager";
import { QuickEditShowParams } from "./QuickEditQuickPick";

export async function addCurrentSelectionToEdit({
  webviewProtocol,
  verticalDiffManager,
  args,
  editDecorationManager,
}: {
  webviewProtocol: VsCodeWebviewProtocol;
  verticalDiffManager: VerticalDiffManager;
  args: QuickEditShowParams | undefined;
  editDecorationManager: EditDecorationManager;
}) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    return;
  }

  const existingDiff = verticalDiffManager.getHandlerForFile(
    editor.document.fileName,
  );

  // If there's a diff currently being applied, then we just toggle focus back to the input
  if (existingDiff) {
    webviewProtocol?.request("focusContinueInput", undefined);
    return;
  }

  const startFromCharZero = editor.selection.start.with(undefined, 0);
  const document = editor.document;
  let lastLine, lastChar;
  // If the user selected onto a trailing line but didn't actually include any characters in it
  // they don't want to include that line, so trim it off.
  if (editor.selection.end.character === 0) {
    // This is to prevent the rare case that the previous line gets selected when user
    // is selecting nothing and the cursor is at the beginning of the line
    if (editor.selection.end.line === editor.selection.start.line) {
      lastLine = editor.selection.start.line;
    } else {
      lastLine = editor.selection.end.line - 1;
    }
  } else {
    lastLine = editor.selection.end.line;
  }
  lastChar = document.lineAt(lastLine).range.end.character;
  const endAtCharLast = new vscode.Position(lastLine, lastChar);
  const range =
    args?.range ?? new vscode.Range(startFromCharZero, endAtCharLast);

  editDecorationManager.clear();
  editDecorationManager.addDecorations(editor, [range]);

  const rangeInFileWithContents = getRangeInFileWithContents(true, range);

  if (rangeInFileWithContents) {
    webviewProtocol?.request("setCodeToEdit", rangeInFileWithContents);

    // Un-select the current selection
    editor.selection = new vscode.Selection(
      editor.selection.anchor,
      editor.selection.anchor,
    );
  }
}
