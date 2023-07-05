import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

interface DiffInfo {
  originalFilepath: string;
  newFilepath: string;
  editor?: vscode.TextEditor;
}

export const DIFF_DIRECTORY = path.join(os.homedir(), ".continue", "diffs");

class DiffManager {
  // Create a temporary file in the global .continue directory which displays the updated version
  // Doing this because virtual files are read-only
  private diffs: Map<string, DiffInfo> = new Map();

  private setupDirectory() {
    // Make sure the diff directory exists
    if (!fs.existsSync(DIFF_DIRECTORY)) {
      fs.mkdirSync(DIFF_DIRECTORY, {
        recursive: true,
      });
    }
  }

  constructor() {
    this.setupDirectory();
  }

  private escapeFilepath(filepath: string): string {
    return filepath.replace(/\\/g, "_").replace(/\//g, "_");
  }

  private openDiffEditor(
    originalFilepath: string,
    newFilepath: string,
    newContent: string
  ): vscode.TextEditor {
    const rightUri = vscode.Uri.parse(newFilepath);
    const leftUri = vscode.Uri.file(originalFilepath);
    const title = "Continue Diff";
    vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("No active text editor found for Continue Diff");
    }
    return editor;
  }

  writeDiff(originalFilepath: string, newContent: string): string {
    this.setupDirectory();

    // Create or update existing diff
    const newFilepath = path.join(
      DIFF_DIRECTORY,
      this.escapeFilepath(originalFilepath)
    );
    fs.writeFileSync(newFilepath, newContent);

    // Open the diff editor if this is a new diff
    if (!this.diffs.has(newFilepath)) {
      const diffInfo: DiffInfo = {
        originalFilepath,
        newFilepath,
      };
      diffInfo.editor = this.openDiffEditor(
        originalFilepath,
        newFilepath,
        newContent
      );
      this.diffs.set(newFilepath, diffInfo);
    }
    return newFilepath;
  }

  cleanUpDiff(diffInfo: DiffInfo) {
    // Close the editor, remove the record, delete the file
    if (diffInfo.editor) {
      vscode.window.showTextDocument(diffInfo.editor.document);
      vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    }
    this.diffs.delete(diffInfo.newFilepath);
    fs.unlinkSync(diffInfo.newFilepath);
  }

  acceptDiff(newFilepath: string) {
    // Get the diff info, copy new file to original, then delete from record and close the corresponding editor
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      return;
    }
    fs.writeFileSync(
      diffInfo.originalFilepath,
      fs.readFileSync(diffInfo.newFilepath)
    );
    this.cleanUpDiff(diffInfo);
  }

  rejectDiff(newFilepath: string) {
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      return;
    }

    this.cleanUpDiff(diffInfo);
  }
}

export const diffManager = new DiffManager();

export async function acceptDiffCommand(newFilepath: string) {
  diffManager.acceptDiff(newFilepath);
}

export async function rejectDiffCommand(newFilepath: string) {
  diffManager.rejectDiff(newFilepath);
}
