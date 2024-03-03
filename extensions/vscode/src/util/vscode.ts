import { machineIdSync } from "node-machine-id";
import * as path from "path";
import * as vscode from "vscode";

export function translate(range: vscode.Range, lines: number): vscode.Range {
  return new vscode.Range(
    range.start.line + lines,
    range.start.character,
    range.end.line + lines,
    range.end.character,
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

export function getExtensionUri(): vscode.Uri {
  return vscode.extensions.getExtension("Continue.continue")!.extensionUri;
}

export function getViewColumnOfFile(
  filepath: string,
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

let showTextDocumentInProcess = false;

export function openEditorAndRevealRange(
  editorFilename: string,
  range?: vscode.Range,
  viewColumn?: vscode.ViewColumn,
): Promise<vscode.TextEditor> {
  return new Promise((resolve, _) => {
    if (editorFilename.startsWith("~")) {
      editorFilename = path.join(
        process.env.HOME || process.env.USERPROFILE || "",
        editorFilename.slice(1),
      );
    }
    vscode.workspace.openTextDocument(editorFilename).then(async (doc) => {
      try {
        // An error is thrown mysteriously if you open two documents in parallel, hence this
        while (showTextDocumentInProcess) {
          await new Promise((resolve) => {
            setInterval(() => {
              resolve(null);
            }, 200);
          });
        }
        showTextDocumentInProcess = true;
        vscode.window
          .showTextDocument(
            doc,
            getViewColumnOfFile(editorFilename) || viewColumn,
          )
          .then((editor) => {
            if (range) {
              editor.revealRange(range);
            }
            resolve(editor);
            showTextDocumentInProcess = false;
          });
      } catch (err) {
        console.log(err);
      }
    });
  });
}

function windowsToPosix(windowsPath: string): string {
  let posixPath = windowsPath.split("\\").join("/");
  if (posixPath[1] === ":") {
    posixPath = posixPath.slice(2);
  }
  // posixPath = posixPath.replace(" ", "\\ ");
  return posixPath;
}

function isWindowsLocalButNotRemote(): boolean {
  return (
    vscode.env.remoteName !== undefined &&
    ["wsl", "ssh-remote", "dev-container", "attached-container"].includes(
      vscode.env.remoteName,
    ) &&
    process.platform === "win32"
  );
}

export function getPathSep(): string {
  return isWindowsLocalButNotRemote() ? "/" : path.sep;
}

export function uriFromFilePath(filepath: string): vscode.Uri {
  if (vscode.env.remoteName) {
    if (isWindowsLocalButNotRemote()) {
      filepath = windowsToPosix(filepath);
    }
    return vscode.Uri.parse(
      `vscode-remote://${vscode.env.remoteName}${filepath}`,
    );
  } else {
    return vscode.Uri.file(filepath);
  }
}

export function getUniqueId() {
  const id = vscode.env.machineId;
  if (id === "someValue.machineId") {
    return machineIdSync();
  }
  return vscode.env.machineId;
}
