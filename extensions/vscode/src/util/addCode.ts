import * as os from "node:os";

import { RangeInFileWithContents } from "core";
import * as vscode from "vscode";

import { VsCodeIdeUtils } from "./ideUtils";

import type { VsCodeWebviewProtocol } from "../webviewProtocol";

export function getRangeInFileWithContents(
  allowEmpty?: boolean,
  range?: vscode.Range,
): RangeInFileWithContents | null {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    const selection = editor.selection;
    const filepath = editor.document.uri.toString();

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

    if ((selection.isEmpty && !allowEmpty) || isEmptyFile(editor.document)) {
      return null;
    }

    let selectionRange: vscode.Range | undefined;
    // if the selection is empty and document is not empty, select the whole document
    if (selection.isEmpty) {
      selectionRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(
          editor.document.lineCount - 1,
          editor.document.lineAt(
            editor.document.lineCount - 1,
          ).range.end.character,
        ),
      );
    }

    if (!selectionRange) {
      selectionRange = new vscode.Range(selection.start, selection.end);
      const document = editor.document;
      // Select the context from the beginning of the selection start line to the selection start position
      const beginningOfSelectionStartLine = selection.start.with(undefined, 0);
      const textBeforeSelectionStart = document.getText(
        new vscode.Range(beginningOfSelectionStartLine, selection.start),
      );
      // If there are only whitespace before the start of the selection, include the indentation
      if (textBeforeSelectionStart.trim().length === 0) {
        selectionRange = selectionRange.with({
          start: beginningOfSelectionStartLine,
        });
      }
    }

    const contents = editor.document.getText(selectionRange);

    return {
      filepath,
      contents,
      range: {
        start: {
          line: selectionRange.start.line,
          character: selectionRange.start.character,
        },
        end: {
          line: selectionRange.end.line,
          character: selectionRange.end.character,
        },
      },
    };
  }

  return null;
}

export async function addHighlightedCodeToContext(
  webviewProtocol: VsCodeWebviewProtocol | undefined,
) {
  // the passed argument below was set to true in https://github.com/continuedev/continue/pull/6711
  // which would add the entire file contents when selection is empty
  // some of this behaviour is reverted and needs further investigation
  const rangeInFileWithContents = getRangeInFileWithContents(false);
  if (rangeInFileWithContents) {
    webviewProtocol?.request("highlightedCode", {
      rangeInFileWithContents,
    });
  }
}

export async function addEntireFileToContext(
  uri: vscode.Uri,
  webviewProtocol: VsCodeWebviewProtocol | undefined,
  ideUtils: VsCodeIdeUtils,
) {
  // If a directory, add all files in the directory
  const stat = await ideUtils.stat(uri);
  if (stat?.type === vscode.FileType.Directory) {
    const files = (await ideUtils.readDirectory(uri))!; //files can't be null if we reached this point
    for (const [filename, type] of files) {
      if (type === vscode.FileType.File) {
        addEntireFileToContext(
          vscode.Uri.joinPath(uri, filename),
          webviewProtocol,
          ideUtils,
        );
      }
    }
    return;
  }

  // Get the contents of the file
  const contents = (await vscode.workspace.fs.readFile(uri)).toString();
  const rangeInFileWithContents = {
    filepath: uri.toString(),
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

export function isEmptyFile(document: vscode.TextDocument) {
  return document.lineCount === 1 && document.lineAt(0).range.isEmpty;
}

export function addCodeToContextFromRange(
  range: vscode.Range,
  webviewProtocol: VsCodeWebviewProtocol,
  prompt?: string,
) {
  const document = vscode.window.activeTextEditor?.document;

  if (!document) {
    return;
  }

  const rangeInFileWithContents = {
    filepath: document.uri.toString(),
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
