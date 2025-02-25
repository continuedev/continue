import { myersDiff } from "core/diff/myers";
import * as URI from "uri-js";
import * as vscode from "vscode";

import {
  DecorationTypeRangeManager,
  belowIndexDecorationType,
  greenDecorationType,
  indexDecorationType,
  redDecorationType,
} from "./decorations";

import type { ApplyState, DiffLine } from "core";
import type { VerticalDiffCodeLens } from "./manager";

export interface VerticalDiffHandlerOptions {
  input?: string;
  instant?: boolean;
  onStatusUpdate: (
    status?: ApplyState["status"],
    numDiffs?: ApplyState["numDiffs"],
    fileContent?: ApplyState["fileContent"],
  ) => void;
}

export class VerticalDiffHandler implements vscode.Disposable {
  private currentLineIndex: number;
  private cancelled = false;
  private newLinesAdded = 0;
  private deletionBuffer: string[] = [];
  private redDecorationManager: DecorationTypeRangeManager;
  private get fileUri() {
    return this.editor.document.uri.toString();
  }
  public insertedInCurrentBlock = 0;
  public get range(): vscode.Range {
    const startLine = Math.min(this.startLine, this.endLine);
    const endLine = Math.max(this.startLine, this.endLine);
    return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
  }

  constructor(
    private startLine: number,
    private endLine: number,
    private editor: vscode.TextEditor,
    private readonly editorToVerticalDiffCodeLens: Map<
      string,
      VerticalDiffCodeLens[]
    >,
    private readonly clearForFileUri: (
      fileUri: string | undefined,
      accept: boolean,
    ) => void,
    private readonly refreshCodeLens: () => void,
    public options: VerticalDiffHandlerOptions,
  ) {
    this.currentLineIndex = startLine;

    this.redDecorationManager = new DecorationTypeRangeManager(
      redDecorationType,
      this.editor,
    );

    this.greenDecorationManager = new DecorationTypeRangeManager(
      greenDecorationType,
      this.editor,
    );

    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        return;
      }
      // When we switch away and back to this editor, need to re-draw decorations
      if (URI.equal(editor.document.uri.toString(), this.fileUri)) {
        this.editor = editor;
        this.redDecorationManager.applyToNewEditor(editor);
        this.greenDecorationManager.applyToNewEditor(editor);
        this.updateIndexLineDecorations();
        this.refreshCodeLens();

        // Handle any lines received while editor was closed
        this.queueDiffLine(undefined);
      }
    });
    this.disposables.push(disposable);
  }

  private async insertDeletionBuffer() {
    const totalDeletedContent = this.deletionBuffer.join("\n");

    if (this.deletionBuffer.length || this.insertedInCurrentBlock > 0) {
      const blocks = this.editorToVerticalDiffCodeLens.get(this.fileUri) || [];

      blocks.push({
        start: this.currentLineIndex - this.insertedInCurrentBlock,
        numRed: this.deletionBuffer.length,
        numGreen: this.insertedInCurrentBlock,
      });

      this.editorToVerticalDiffCodeLens.set(this.fileUri, blocks);
    }

    if (this.deletionBuffer.length === 0) {
      this.insertedInCurrentBlock = 0;
      return;
    }

    // Insert the block of deleted lines
    await this.insertTextAboveLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      totalDeletedContent,
    );

    this.redDecorationManager.addLines(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length,
    );

    // Shift green decorations downward
    this.greenDecorationManager.shiftDownAfterLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length,
    );

    // Update line index, clear buffer
    for (let i = 0; i < this.deletionBuffer.length; i++) {
      this.incrementCurrentLineIndex();
    }

    this.deletionBuffer = [];
    this.insertedInCurrentBlock = 0;
    this.refreshCodeLens();
  }

  private incrementCurrentLineIndex() {
    this.currentLineIndex++;
    this.updateIndexLineDecorations();
  }

  private greenDecorationManager: DecorationTypeRangeManager;

  private async insertTextAboveLine(index: number, text: string) {
    await this.editor.edit(
      (editBuilder) => {
        const lineCount = this.editor.document.lineCount;
        if (index >= lineCount) {
          // Append to end of file
          editBuilder.insert(
            new vscode.Position(
              lineCount,
              this.editor.document.lineAt(lineCount - 1).text.length,
            ),
            `\n${text}`,
          );
        } else {
          editBuilder.insert(new vscode.Position(index, 0), `${text}\n`);
        }
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );
  }

  private async insertLineAboveIndex(index: number, line: string) {
    await this.insertTextAboveLine(index, line);
    this.greenDecorationManager.addLine(index);
    this.newLinesAdded++;
  }

  private async deleteLinesAt(index: number, numLines = 1) {
    const startLine = new vscode.Position(index, 0);
    await this.editor.edit(
      (editBuilder) => {
        editBuilder.delete(
          new vscode.Range(startLine, startLine.translate(numLines)),
        );
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );
  }

  private updateIndexLineDecorations() {
    if (this.options.instant) {
      // We don't show progress on instant apply
      return;
    }

    // Highlight the line at the currentLineIndex
    // And lightly highlight all lines between that and endLine
    if (this.currentLineIndex - this.newLinesAdded >= this.endLine) {
      this.editor.setDecorations(indexDecorationType, []);
      this.editor.setDecorations(belowIndexDecorationType, []);
    } else {
      const start = new vscode.Position(this.currentLineIndex, 0);
      this.editor.setDecorations(indexDecorationType, [
        new vscode.Range(
          start,
          new vscode.Position(start.line, Number.MAX_SAFE_INTEGER),
        ),
      ]);
      const end = new vscode.Position(this.endLine, 0);
      this.editor.setDecorations(belowIndexDecorationType, [
        new vscode.Range(start.translate(1), end.translate(this.newLinesAdded)),
      ]);
    }
  }

  private clearIndexLineDecorations() {
    this.editor.setDecorations(belowIndexDecorationType, []);
    this.editor.setDecorations(indexDecorationType, []);
  }

  public getLineDeltaBeforeLine(line: number) {
    // Returns the number of lines removed from a file when the diff currently active is closed
    let totalLineDelta = 0;
    for (const range of this.greenDecorationManager
      .getRanges()
      .sort((a, b) => a.start.line - b.start.line)) {
      if (range.start.line > line) {
        break;
      }

      totalLineDelta -= range.end.line - range.start.line + 1;
    }

    return totalLineDelta;
  }

  async clear(accept: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      false,
    );
    const rangesToDelete = accept
      ? this.redDecorationManager.getRanges()
      : this.greenDecorationManager.getRanges();

    this.clearDecorations();

    await this.editor.edit(
      (editBuilder) => {
        for (const range of rangesToDelete) {
          editBuilder.delete(
            new vscode.Range(
              range.start,
              new vscode.Position(range.end.line + 1, 0),
            ),
          );
        }
      },
      {
        undoStopAfter: false,
        undoStopBefore: false,
      },
    );

    this.options.onStatusUpdate(
      "closed",
      this.editorToVerticalDiffCodeLens.get(this.fileUri)?.length ?? 0,
      this.editor.document.getText(),
    );

    this.cancelled = true;
    this.refreshCodeLens();
    this.dispose();
  }

  disposables: vscode.Disposable[] = [];

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  get isCancelled() {
    return this.cancelled;
  }

  private _diffLinesQueue: DiffLine[] = [];
  private _queueLock = false;

  async queueDiffLine(diffLine: DiffLine | undefined) {
    if (diffLine) {
      this._diffLinesQueue.push(diffLine);
    }

    if (this._queueLock || this.editor !== vscode.window.activeTextEditor) {
      return;
    }

    this._queueLock = true;

    while (this._diffLinesQueue.length) {
      const line = this._diffLinesQueue.shift();
      if (!line) {
        break;
      }

      try {
        await this._handleDiffLine(line);
      } catch (e) {
        // If editor is switched between calling _handleDiffLine and the edit actually being executed
        this._diffLinesQueue.push(line);
        break;
      }
    }

    this._queueLock = false;
  }

  private async _handleDiffLine(diffLine: DiffLine) {
    switch (diffLine.type) {
      case "same":
        await this.insertDeletionBuffer();
        this.incrementCurrentLineIndex();
        break;
      case "old":
        // Add to deletion buffer and delete the line for now
        this.deletionBuffer.push(diffLine.line);
        await this.deleteLinesAt(this.currentLineIndex);
        break;
      case "new":
        await this.insertLineAboveIndex(this.currentLineIndex, diffLine.line);
        this.incrementCurrentLineIndex();
        this.insertedInCurrentBlock++;
        break;
    }
  }

  async run(diffLineGenerator: AsyncGenerator<DiffLine>) {
    let diffLines = [];

    try {
      // As an indicator of loading
      this.updateIndexLineDecorations();

      for await (const diffLine of diffLineGenerator) {
        if (this.isCancelled) {
          return;
        }
        diffLines.push(diffLine);
        await this.queueDiffLine(diffLine);
      }

      // Clear deletion buffer
      await this.insertDeletionBuffer();

      await this.reapplyWithMyersDiff(diffLines);

      this.options.onStatusUpdate(
        "done",
        this.editorToVerticalDiffCodeLens.get(this.fileUri)?.length ?? 0,
        this.editor.document.getText(),
      );

      // Reject on user typing
      // const listener = vscode.workspace.onDidChangeTextDocument((e) => {
      //   if (URI.equal(e.document.uri.toString(), this.fileUri)) {
      //     this.clear(false);
      //     listener.dispose();
      //   }
      // });
    } catch (e) {
      this.clearForFileUri(this.fileUri, false);
      throw e;
    }
    return diffLines;
  }

  async acceptRejectBlock(
    accept: boolean,
    startLine: number,
    numGreen: number,
    numRed: number,
    skipStatusUpdate?: boolean,
  ) {
    if (numGreen > 0) {
      // Delete the editor decoration
      this.greenDecorationManager.deleteRangeStartingAt(startLine + numRed);
      if (!accept) {
        // Delete the actual lines
        await this.deleteLinesAt(startLine + numRed, numGreen);
      }
    }

    if (numRed > 0) {
      const rangeToDelete =
        this.redDecorationManager.deleteRangeStartingAt(startLine);

      if (accept) {
        // Delete the actual lines
        await this.deleteLinesAt(startLine, numRed);
      }
    }

    // Shift everything below upward
    const offset = -(accept ? numRed : numGreen);

    this.redDecorationManager.shiftDownAfterLine(startLine, offset);
    this.greenDecorationManager.shiftDownAfterLine(startLine, offset);

    // Shift the codelens objects
    this.shiftCodeLensObjects(startLine, offset);

    if (!skipStatusUpdate) {
      const numDiffs =
        this.editorToVerticalDiffCodeLens.get(this.fileUri)?.length ?? 0;

      const status = numDiffs === 0 ? "closed" : undefined;

      this.options.onStatusUpdate(
        status,
        numDiffs,
        this.editor.document.getText(),
      );
    }
  }

  private shiftCodeLensObjects(startLine: number, offset: number) {
    // Shift the codelens objects
    const blocks =
      this.editorToVerticalDiffCodeLens
        .get(this.fileUri)
        ?.filter((x) => x.start !== startLine)
        .map((x) => {
          if (x.start > startLine) {
            return { ...x, start: x.start + offset };
          }
          return x;
        }) || [];
    this.editorToVerticalDiffCodeLens.set(this.fileUri, blocks);

    this.refreshCodeLens();
  }

  public updateLineDelta(
    fileUri: string,
    startLine: number,
    lineDelta: number,
  ) {
    // Retrieve the diff blocks for the given file
    const blocks = this.editorToVerticalDiffCodeLens.get(fileUri);
    if (!blocks) {
      return;
    }

    //update decorations
    this.redDecorationManager.shiftDownAfterLine(startLine, lineDelta);
    this.greenDecorationManager.shiftDownAfterLine(startLine, lineDelta);

    //update code lens
    this.shiftCodeLensObjects(startLine, lineDelta);
  }

  public hasDiffForCurrentFile(): boolean {
    const diffBlocks = this.editorToVerticalDiffCodeLens.get(this.fileUri);
    return diffBlocks !== undefined && diffBlocks.length > 0;
  }

  clearDecorations() {
    this.redDecorationManager.clear();
    this.greenDecorationManager.clear();
    this.clearIndexLineDecorations();
    this.editorToVerticalDiffCodeLens.delete(this.fileUri);
    this.refreshCodeLens();
  }

  /**
   * This method is used to apply diff decorations after the intiial stream.
   * This is to handle scenarios where we miscalculate the original diff blocks,
   * and decide to follow up with a deterministic algorithm like Myers Diff once
   * we have received all of the diff lines.
   */
  async reapplyWithMyersDiff(diffLines: DiffLine[]) {
    // Diff is messed up without this delay.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // First, we reset the original diff by rejecting all pending diff blocks
    const blocks = this.editorToVerticalDiffCodeLens.get(this.fileUri) ?? [];
    for (const block of blocks.reverse()) {
      await this.acceptRejectBlock(
        false,
        block.start,
        block.numGreen,
        block.numRed,
        true,
      );
    }

    this.clearDecorations();

    // Then, get our old/new file content based on the original lines
    const oldFileContent = diffLines
      .filter((line) => line.type === "same" || line.type === "old")
      .map((line) => line.line)
      .join("\n");

    const newFileContent = diffLines
      .filter((line) => line.type === "same" || line.type === "new")
      .map((line) => line.line)
      .join("\n");

    const diffs = myersDiff(oldFileContent, newFileContent);

    const myersDiffLines = diffs.map((diff) => diff.line).join("\n");

    // Then, we insert our diff lines
    await this.editor.edit((editBuilder) => {
      editBuilder.replace(this.range, myersDiffLines),
        {
          undoStopAfter: false,
          undoStopBefore: false,
        };
    });

    // Lastly, we apply decorations
    let numRed = 0;
    let numGreen = 0;

    const codeLensBlocks: VerticalDiffCodeLens[] = [];

    diffs.forEach((diff, index) => {
      if (diff.type === "old") {
        this.redDecorationManager.addLine(this.startLine + index);
        numRed++;
      } else if (diff.type === "new") {
        this.greenDecorationManager.addLine(this.startLine + index);
        numGreen++;
      } else if (diff.type === "same" && (numRed > 0 || numGreen > 0)) {
        codeLensBlocks.push({
          numRed,
          numGreen,
          start: this.startLine + index - numRed - numGreen,
        });
        numRed = 0;
        numGreen = 0;
      }
    });

    if (numRed > 0 || numGreen > 0) {
      codeLensBlocks.push({
        numGreen,
        numRed,
        start: this.startLine + diffs.length - numRed - numGreen,
      });
    }

    this.editorToVerticalDiffCodeLens.set(this.fileUri, codeLensBlocks);
    this.refreshCodeLens();
  }
}
