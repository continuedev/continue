import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function translate(range: vscode.Range, lines: number): vscode.Range {
  return new vscode.Range(
    range.start.line + lines,
    range.start.character,
    range.end.line + lines,
    range.end.character
  );
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getTestFile(
  filename: string,
  createFile: boolean = false
): string {
  let basename = path.basename(filename).split(".")[0];
  switch (path.extname(filename)) {
    case ".py":
      basename += "_test";
      break;
    case ".js":
    case ".jsx":
    case ".ts":
    case ".tsx":
      basename += ".test";
      break;
    default:
      basename += "_test";
  }

  const directory = path.join(path.dirname(filename), "tests");
  const testFilename = path.join(directory, basename + path.extname(filename));

  // Optionally, create the file if it doesn't exist
  if (createFile && !fs.existsSync(testFilename)) {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory);
    }
    fs.writeFileSync(testFilename, "");
  }

  return testFilename;
}

export function getExtensionUri(): vscode.Uri {
  return vscode.extensions.getExtension("Continue.continue")!.extensionUri;
}

export function getViewColumnOfFile(
  filepath: string
): vscode.ViewColumn | undefined {
  for (let tabGroup of vscode.window.tabGroups.all) {
    for (let tab of tabGroup.tabs) {
      if (
        (tab?.input as any)?.uri &&
        (tab.input as any).uri.fsPath === filepath
      ) {
        return tabGroup.viewColumn;
      }
    }
  }
  return undefined;
}

export function getRightViewColumn(): vscode.ViewColumn {
  // When you want to place in the rightmost panel if there is already more than one, otherwise use Beside
  let column = vscode.ViewColumn.Beside;
  let columnOrdering = [
    vscode.ViewColumn.One,
    vscode.ViewColumn.Beside,
    vscode.ViewColumn.Two,
    vscode.ViewColumn.Three,
    vscode.ViewColumn.Four,
    vscode.ViewColumn.Five,
    vscode.ViewColumn.Six,
    vscode.ViewColumn.Seven,
    vscode.ViewColumn.Eight,
    vscode.ViewColumn.Nine,
  ];
  for (let tabGroup of vscode.window.tabGroups.all) {
    if (
      columnOrdering.indexOf(tabGroup.viewColumn) >
      columnOrdering.indexOf(column)
    ) {
      column = tabGroup.viewColumn;
    }
  }
  return column;
}

export async function readFileAtRange(
  range: vscode.Range,
  filepath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        let lines = data.toString().split("\n");
        if (range.isSingleLine) {
          resolve(
            lines[range.start.line].slice(
              range.start.character,
              range.end.character
            )
          );
        } else {
          let firstLine = lines[range.start.line].slice(range.start.character);
          let lastLine = lines[range.end.line].slice(0, range.end.character);
          let middleLines = lines.slice(range.start.line + 1, range.end.line);
          resolve([firstLine, ...middleLines, lastLine].join("\n"));
        }
      }
    });
  });
}

let showTextDocumentInProcess = false;

export function openEditorAndRevealRange(
  editorFilename: string,
  range?: vscode.Range,
  viewColumn?: vscode.ViewColumn
): Promise<vscode.TextEditor> {
  return new Promise((resolve, _) => {
    vscode.workspace.openTextDocument(editorFilename).then(async (doc) => {
      try {
        // An error is thrown mysteriously if you open two documents in parallel, hence this
        while (showTextDocumentInProcess) {
          await new Promise((resolve) => {
            setInterval(() => {
              resolve(null);
            }, 200);
          })
        }
        showTextDocumentInProcess = true;
        vscode.window
          .showTextDocument(
            doc,
            getViewColumnOfFile(editorFilename) || viewColumn
          )
          .then((editor) => {
            if (range) {
              editor.revealRange(range);
            }
            resolve(editor);
            showTextDocumentInProcess = false;
          })
        } catch (err) {
          console.log(err);
        }
      });
  });
}
