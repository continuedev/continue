import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { extensionContext, ideProtocolClient } from "./activation/activate";
import { getMetaKeyLabel } from "./util/util";
import { devDataPath } from "./activation/environmentSetup";
import { uriFromFilePath } from "./util/vscode";

interface DiffInfo {
  originalFilepath: string;
  newFilepath: string;
  editor?: vscode.TextEditor;
  step_index: number;
  range: vscode.Range;
}

async function readFile(path: string): Promise<string> {
  return await vscode.workspace.fs
    .readFile(uriFromFilePath(path))
    .then((bytes) => new TextDecoder().decode(bytes));
}

async function writeFile(path: string, contents: string) {
  await vscode.workspace.fs.writeFile(
    uriFromFilePath(path),
    new TextEncoder().encode(contents)
  );
}

export const DIFF_DIRECTORY = path
  .join(os.homedir(), ".continue", "diffs")
  .replace(/^C:/, "c:");

class DiffManager {
  // Create a temporary file in the global .continue directory which displays the updated version
  // Doing this because virtual files are read-only
  private diffs: Map<string, DiffInfo> = new Map();

  diffAtNewFilepath(newFilepath: string): DiffInfo | undefined {
    return this.diffs.get(newFilepath);
  }

  private async setupDirectory() {
    // Make sure the diff directory exists
    await vscode.workspace.fs.createDirectory(uriFromFilePath(DIFF_DIRECTORY));
  }

  constructor() {
    this.setupDirectory();

    // Listen for file closes, and if it's a diff file, clean up
    vscode.workspace.onDidCloseTextDocument((document) => {
      const newFilepath = document.uri.fsPath;
      const diffInfo = this.diffs.get(newFilepath);
      if (diffInfo) {
        this.cleanUpDiff(diffInfo, false);
      }
    });
  }

  private escapeFilepath(filepath: string): string {
    return filepath.replace(/\\/g, "_").replace(/\//g, "_");
  }

  private getNewFilepath(originalFilepath: string): string {
    return path.join(DIFF_DIRECTORY, this.escapeFilepath(originalFilepath));
  }

  private async openDiffEditor(
    originalFilepath: string,
    newFilepath: string
  ): Promise<vscode.TextEditor | undefined> {
    // If the file doesn't yet exist or the basename is a single digit number (vscode terminal), don't open the diff editor
    try {
      await vscode.workspace.fs.stat(uriFromFilePath(newFilepath));
    } catch {
      return undefined;
    }
    if (path.basename(originalFilepath).match(/^\d$/)) {
      return undefined;
    }

    const rightUri = uriFromFilePath(newFilepath);
    const leftUri = uriFromFilePath(originalFilepath);
    const title = "Continue Diff";
    console.log(
      "Opening diff window with ",
      leftUri,
      rightUri,
      title,
      newFilepath,
      originalFilepath
    );
    vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("No active text editor found for Continue Diff");
    }

    // Change the vscode setting to allow codeLens in diff editor
    vscode.workspace
      .getConfiguration("diffEditor", editor.document.uri)
      .update("codeLens", true, vscode.ConfigurationTarget.Global);

    if (
      extensionContext?.globalState.get<boolean>(
        "continue.showDiffInfoMessage"
      ) !== false
    ) {
      vscode.window
        .showInformationMessage(
          `Accept (${getMetaKeyLabel()}⇧↩) or reject (${getMetaKeyLabel()}⇧⌫) at the top of the file.`,
          "Got it",
          "Don't show again"
        )
        .then((selection) => {
          if (selection === "Don't show again") {
            // Get the global state
            extensionContext?.globalState.update(
              "continue.showDiffInfoMessage",
              false
            );
          }
        });
    }

    return editor;
  }

  private _findFirstDifferentLine(contentA: string, contentB: string): number {
    const linesA = contentA.split("\n");
    const linesB = contentB.split("\n");
    for (let i = 0; i < linesA.length && i < linesB.length; i++) {
      if (linesA[i] !== linesB[i]) {
        return i;
      }
    }
    return 0;
  }

  async writeDiff(
    originalFilepath: string,
    newContent: string,
    step_index: number
  ): Promise<string> {
    await this.setupDirectory();

    // Create or update existing diff
    const newFilepath = this.getNewFilepath(originalFilepath);
    await writeFile(newFilepath, newContent);

    // Open the diff editor if this is a new diff
    if (!this.diffs.has(newFilepath)) {
      // Figure out the first line that is different
      const oldContent = await ideProtocolClient.readFile(originalFilepath);
      const line = this._findFirstDifferentLine(oldContent, newContent);

      const diffInfo: DiffInfo = {
        originalFilepath,
        newFilepath,
        step_index,
        range: new vscode.Range(line, 0, line + 1, 0),
      };
      this.diffs.set(newFilepath, diffInfo);
    }

    // Open the editor if it hasn't been opened yet
    const diffInfo = this.diffs.get(newFilepath);
    if (diffInfo && !diffInfo?.editor) {
      diffInfo.editor = await this.openDiffEditor(
        originalFilepath,
        newFilepath
      );
      this.diffs.set(newFilepath, diffInfo);
    }

    vscode.commands.executeCommand(
      "workbench.action.files.revert",
      uriFromFilePath(newFilepath)
    );

    return newFilepath;
  }

  cleanUpDiff(diffInfo: DiffInfo, hideEditor: boolean = true) {
    // Close the editor, remove the record, delete the file
    if (hideEditor && diffInfo.editor) {
      vscode.window.showTextDocument(diffInfo.editor.document);
      vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
    this.diffs.delete(diffInfo.newFilepath);
    fs.unlinkSync(diffInfo.newFilepath);
  }

  private inferNewFilepath() {
    const activeEditorPath =
      vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeEditorPath && path.dirname(activeEditorPath) === DIFF_DIRECTORY) {
      return activeEditorPath;
    }
    const visibleEditors = vscode.window.visibleTextEditors.map(
      (editor) => editor.document.uri.fsPath
    );
    for (const editorPath of visibleEditors) {
      if (path.dirname(editorPath) === DIFF_DIRECTORY) {
        for (const otherEditorPath of visibleEditors) {
          if (
            path.dirname(otherEditorPath) !== DIFF_DIRECTORY &&
            this.getNewFilepath(otherEditorPath) === editorPath
          ) {
            return editorPath;
          }
        }
      }
    }

    if (this.diffs.size === 1) {
      return Array.from(this.diffs.keys())[0];
    }
    return undefined;
  }

  async acceptDiff(newFilepath?: string) {
    // When coming from a keyboard shortcut, we have to infer the newFilepath from visible text editors
    if (!newFilepath) {
      newFilepath = this.inferNewFilepath();
    }
    if (!newFilepath) {
      console.log("No newFilepath provided to accept the diff");
      return;
    }
    // Get the diff info, copy new file to original, then delete from record and close the corresponding editor
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      console.log("No corresponding diffInfo found for newFilepath");
      return;
    }

    // Save the right-side file, then copy over to original
    vscode.workspace.textDocuments
      .find((doc) => doc.uri.fsPath === newFilepath)
      ?.save()
      .then(async () => {
        await writeFile(
          diffInfo.originalFilepath,
          await readFile(diffInfo.newFilepath)
        );
        this.cleanUpDiff(diffInfo);
      });

    await recordAcceptReject(true, diffInfo);
  }

  async rejectDiff(newFilepath?: string) {
    // If no newFilepath is provided and there is only one in the dictionary, use that
    if (!newFilepath) {
      newFilepath = this.inferNewFilepath();
    }
    if (!newFilepath) {
      console.log(
        "No newFilepath provided to reject the diff, diffs.size was",
        this.diffs.size
      );
      return;
    }
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      console.log("No corresponding diffInfo found for newFilepath");
      return;
    }

    // Stop the step at step_index in case it is still streaming
    ideProtocolClient.deleteAtIndex(diffInfo.step_index);

    vscode.workspace.textDocuments
      .find((doc) => doc.uri.fsPath === newFilepath)
      ?.save()
      .then(() => {
        this.cleanUpDiff(diffInfo);
      });

    await recordAcceptReject(false, diffInfo);
  }
}

export const diffManager = new DiffManager();

async function recordAcceptReject(accepted: boolean, diffInfo: DiffInfo) {
  const devDataDir = devDataPath();
  const suggestionsPath = path.join(devDataDir, "suggestions.json");

  // Initialize suggestions list
  let suggestions = [];

  // Check if suggestions.json exists
  try {
    const rawData = await readFile(suggestionsPath);
    suggestions = JSON.parse(rawData);
  } catch {}

  // Add the new suggestion to the list
  suggestions.push({
    accepted,
    timestamp: Date.now(),
    suggestion: diffInfo.originalFilepath,
  });

  // Send the suggestion to the server
  // ideProtocolClient.sendAcceptRejectSuggestion(accepted);

  // Write the updated suggestions back to the file
  await writeFile(suggestionsPath, JSON.stringify(suggestions, null, 4));
}

export async function acceptDiffCommand(newFilepath?: string) {
  await diffManager.acceptDiff(newFilepath);
  ideProtocolClient.sendAcceptRejectDiff(true);
}

export async function rejectDiffCommand(newFilepath?: string) {
  await diffManager.rejectDiff(newFilepath);
  ideProtocolClient.sendAcceptRejectDiff(false);
}
