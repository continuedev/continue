import * as vscode from "vscode";
import { getRightViewColumn, getTestFile } from "./util/vscode";
import * as path from "path";
import { getLanguageLibrary } from "./languages";

export function showAnswerInTextEditor(
  filename: string,
  range: vscode.Range,
  answer: string
) {
  vscode.workspace.openTextDocument(vscode.Uri.file(filename)).then((doc) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    // Open file, reveal range, show decoration
    vscode.window.showTextDocument(doc).then((new_editor) => {
      new_editor.revealRange(
        new vscode.Range(range.end, range.end),
        vscode.TextEditorRevealType.InCenter
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
    decorationType: vscode.TextEditorDecorationType
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
  decorationType?: vscode.TextEditorDecorationType
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
      path.join(__dirname, "..", "media", "spinner.gif")
    ),
    gutterIconSize: "contain",
  });

export function showGutterSpinner(
  editor: vscode.TextEditor,
  lineno: number
): DecorationKey {
  const key = constructBaseKey(editor, lineno, gutterSpinnerDecorationType);
  decorationManager.addDecoration(key);

  return key;
}

export function showLintMessage(
  editor: vscode.TextEditor,
  lineno: number,
  msg: string
): DecorationKey {
  const key = constructBaseKey(editor, lineno);
  key.decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      contentText: "Linting error",
      color: "rgb(255, 0, 0, 0.6)",
    },
    gutterIconPath: vscode.Uri.file(
      path.join(__dirname, "..", "media", "error.png")
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
  removeOnClick: boolean = true
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

// Show unit test
const pythonImportDistinguisher = (line: string): boolean => {
  if (line.startsWith("from") || line.startsWith("import")) {
    return true;
  }
  return false;
};
const javascriptImportDistinguisher = (line: string): boolean => {
  if (line.startsWith("import")) {
    return true;
  }
  return false;
};
const importDistinguishersMap: {
  [fileExtension: string]: (line: string) => boolean;
} = {
  js: javascriptImportDistinguisher,
  ts: javascriptImportDistinguisher,
  py: pythonImportDistinguisher,
};
function getImportsFromFileString(
  fileString: string,
  importDistinguisher: (line: string) => boolean
): Set<string> {
  let importLines = new Set<string>();
  for (let line of fileString.split("\n")) {
    if (importDistinguisher(line)) {
      importLines.add(line);
    }
  }
  return importLines;
}
function removeRedundantLinesFrom(
  fileContents: string,
  linesToRemove: Set<string>
): string {
  let fileLines = fileContents.split("\n");
  fileLines = fileLines.filter((line: string) => {
    return !linesToRemove.has(line);
  });
  return fileLines.join("\n");
}

export async function writeAndShowUnitTest(
  filename: string,
  test: string
): Promise<DecorationKey> {
  return new Promise((resolve, reject) => {
    let testFilename = getTestFile(filename, true);
    vscode.workspace.openTextDocument(testFilename).then((doc) => {
      let fileContent = doc.getText();
      let fileEmpty = fileContent.trim() === "";
      let existingImportLines = getImportsFromFileString(
        fileContent,
        importDistinguishersMap[doc.fileName.split(".").at(-1) || ".py"]
      );

      // Remove redundant imports, make sure pytest is there
      test = removeRedundantLinesFrom(test, existingImportLines);
      test =
        (fileEmpty
          ? `${getLanguageLibrary(".py").writeImport(
              testFilename,
              filename
            )}\nimport pytest\n\n`
          : "\n\n") +
        test.trim() +
        "\n";

      vscode.window
        .showTextDocument(doc, getRightViewColumn())
        .then((editor) => {
          let lastLine = editor.document.lineAt(editor.document.lineCount - 1);
          let testRange = new vscode.Range(
            lastLine.range.end,
            new vscode.Position(
              test.split("\n").length + lastLine.range.end.line,
              0
            )
          );
          editor
            .edit((edit) => {
              edit.insert(lastLine.range.end, test);
              return true;
            })
            .then((success) => {
              if (!success) reject("Failed to insert test");
              let key = highlightCode(editor, testRange);
              resolve(key);
            });
        });
    });
  });
}
