import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ideProtocolClient } from "./activation/activate";

interface DiffInfo {
  originalFilepath: string;
  newFilepath: string;
  editor?: vscode.TextEditor;
  step_index: number;
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
    newFilepath: string
  ): vscode.TextEditor | undefined {
    // If the file doesn't yet exist, don't open the diff editor
    if (!fs.existsSync(newFilepath)) {
      return undefined;
    }

    const rightUri = vscode.Uri.parse(newFilepath);
    const leftUri = vscode.Uri.file(originalFilepath);
    const title = "Continue Diff";
    vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("No active text editor found for Continue Diff");
    }

    // Change the vscode setting to allow codeLens in diff editor
    vscode.workspace
      .getConfiguration("diffEditor", editor.document.uri)
      .update("codeLens", true, vscode.ConfigurationTarget.Global);

    return editor;
  }

  writeDiff(
    originalFilepath: string,
    newContent: string,
    step_index: number
  ): string {
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
        step_index,
      };
      this.diffs.set(newFilepath, diffInfo);
    }

    // Open the editor if it hasn't been opened yet
    const diffInfo = this.diffs.get(newFilepath);
    if (diffInfo && !diffInfo?.editor) {
      diffInfo.editor = this.openDiffEditor(originalFilepath, newFilepath);
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

  acceptDiff(newFilepath?: string) {
    // If no newFilepath is provided and there is only one in the dictionary, use that
    if (!newFilepath && this.diffs.size === 1) {
      newFilepath = Array.from(this.diffs.keys())[0];
    }
    if (!newFilepath) {
      return;
    }
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

  rejectDiff(newFilepath?: string) {
    // If no newFilepath is provided and there is only one in the dictionary, use that
    if (!newFilepath && this.diffs.size === 1) {
      newFilepath = Array.from(this.diffs.keys())[0];
    }
    if (!newFilepath) {
      return;
    }
    const diffInfo = this.diffs.get(newFilepath);
    if (!diffInfo) {
      return;
    }

    // Stop the step at step_index in case it is still streaming
    ideProtocolClient.deleteAtIndex(diffInfo.step_index);

    this.cleanUpDiff(diffInfo);
  }
}

export const diffManager = new DiffManager();

export async function acceptDiffCommand(newFilepath?: string) {
  diffManager.acceptDiff(newFilepath);
  ideProtocolClient.sendAcceptRejectDiff(true);
}

export async function rejectDiffCommand(newFilepath?: string) {
  diffManager.rejectDiff(newFilepath);
  ideProtocolClient.sendAcceptRejectDiff(false);
}
