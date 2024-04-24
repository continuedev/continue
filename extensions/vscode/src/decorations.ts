import * as path from "path";
import * as vscode from "vscode";
import { uriFromFilePath } from "./util/vscode";

export function showAnswerInTextEditor(
  filename: string,
  range: vscode.Range,
  answer: string,
) {
  vscode.workspace.openTextDocument(uriFromFilePath(filename)).then((doc) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Open file, reveal range, show decoration
    vscode.window.showTextDocument(doc).then((new_editor) => {
      new_editor.revealRange(
        new vscode.Range(range.end, range.end),
        vscode.TextEditorRevealType.InCenter,
      );

      let decorationType = vscode.window.createTextEditorDecorationType({
        after: {
          contentText: answer + "\n",
          color: "rgb(0, 255, 0, 0.8)",
        },
        backgroundColor: "rgb(0, 255, 0, 0.2)",
      });
      new_editor.setDecorations(decorationType, [range]);
      vscode.window.showInformationMessage("Answer found!");

      // Remove decoration when user moves cursor
      vscode.window.onDidChangeTextEditorSelection((e) => {
        if (
          e.textEditor === new_editor &&
          e.selections[0].active.line !== range.end.line
        ) {
          new_editor.setDecorations(decorationType, []);
        }
      });
    });
  });
}

type DecorationKey = {
  editorUri: string;
  options: vscode.DecorationOptions;
  decorationType: vscode.TextEditorDecorationType;
};

class DecorationManager {
  private editorToDecorations = new Map<
    string,
    Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>
  >();

  constructor() {
    vscode.window.onDidChangeVisibleTextEditors((editors) => {
      for (const editor of editors) {
        if (editor.document.isClosed) {
          this.editorToDecorations.delete(editor.document.uri.toString());
        }
      }
    });
  }

  private rerenderDecorations(
    editorUri: string,
    decorationType: vscode.TextEditorDecorationType,
  ) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const decorationTypes = this.editorToDecorations.get(editorUri);
    if (!decorationTypes) {
      return;
    }

    const decorations = decorationTypes.get(decorationType);
    if (!decorations) {
      return;
    }

    editor.setDecorations(decorationType, decorations);
  }

  addDecoration(key: DecorationKey) {
    let decorationTypes = this.editorToDecorations.get(key.editorUri);
    if (!decorationTypes) {
      decorationTypes = new Map();
      decorationTypes.set(key.decorationType, [key.options]);
      this.editorToDecorations.set(key.editorUri, decorationTypes);
    } else {
      const decorations = decorationTypes.get(key.decorationType);
      if (!decorations) {
        decorationTypes.set(key.decorationType, [key.options]);
      } else {
        decorations.push(key.options);
      }
    }

    this.rerenderDecorations(key.editorUri, key.decorationType);

    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.fileName === key.editorUri) {
        this.deleteAllDecorations(key.editorUri);
      }
    });
  }

  deleteDecoration(key: DecorationKey) {
    let decorationTypes = this.editorToDecorations.get(key.editorUri);
    if (!decorationTypes) {
      return;
    }

    let decorations = decorationTypes?.get(key.decorationType);
    if (!decorations) {
      return;
    }

    decorations = decorations.filter((decOpts) => decOpts !== key.options);
    decorationTypes.set(key.decorationType, decorations);
    this.rerenderDecorations(key.editorUri, key.decorationType);
  }

  deleteAllDecorations(editorUri: string) {
    let decorationTypes = this.editorToDecorations.get(editorUri)?.keys();
    if (!decorationTypes) {
      return;
    }
    this.editorToDecorations.delete(editorUri);
    for (let decorationType of decorationTypes) {
      this.rerenderDecorations(editorUri, decorationType);
    }
  }
}

export const decorationManager = new DecorationManager();

function constructBaseKey(
  editor: vscode.TextEditor,
  lineno: number,
  decorationType?: vscode.TextEditorDecorationType,
): DecorationKey {
  return {
    editorUri: editor.document.uri.toString(),
    options: {
      range: new vscode.Range(lineno, 0, lineno, 0),
    },
    decorationType:
      decorationType || vscode.window.createTextEditorDecorationType({}),
  };
}

const gutterSpinnerDecorationType =
  vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.file(
      path.join(__dirname, "..", "media", "spinner.gif"),
    ),
    gutterIconSize: "contain",
  });

export function showGutterSpinner(
  editor: vscode.TextEditor,
  lineno: number,
): DecorationKey {
  const key = constructBaseKey(editor, lineno, gutterSpinnerDecorationType);
  decorationManager.addDecoration(key);

  return key;
}

export function showLintMessage(
  editor: vscode.TextEditor,
  lineno: number,
  msg: string,
): DecorationKey {
  const key = constructBaseKey(editor, lineno);
  key.decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: "Linting error",
      color: "rgb(255, 0, 0, 0.6)",
    },
    gutterIconPath: vscode.Uri.file(
      path.join(__dirname, "..", "media", "error.png"),
    ),
    gutterIconSize: "contain",
  });
  key.options.hoverMessage = msg;
  decorationManager.addDecoration(key);
  return key;
}

export function highlightCode(
  editor: vscode.TextEditor,
  range: vscode.Range,
  removeOnClick: boolean = true,
): DecorationKey {
  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "rgb(255, 255, 0, 0.1)",
  });
  const key = {
    editorUri: editor.document.uri.toString(),
    options: {
      range,
    },
    decorationType,
  };
  decorationManager.addDecoration(key);

  if (removeOnClick) {
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor === editor) {
        decorationManager.deleteDecoration(key);
      }
    });
  }

  return key;
}
