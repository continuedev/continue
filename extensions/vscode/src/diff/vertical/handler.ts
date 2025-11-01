import { myersDiff } from "core/diff/myers";
import * as URI from "uri-js";
import * as vscode from "vscode";

import {
  AddedLineDecorationManager,
  RemovedLineDecorationManager,
  belowIndexDecorationType,
  indexDecorationType,
} from "./decorations";

import type { ApplyState, DiffLine } from "core";
import type { VerticalDiffCodeLens } from "./manager";
import { getFirstChangedLine } from "./util";

export interface VerticalDiffHandlerOptions {
  input?: string;
  instant?: boolean;
  onStatusUpdate: (
    status?: ApplyState["status"],
    numDiffs?: ApplyState["numDiffs"],
    fileContent?: ApplyState["fileContent"],
  ) => void;
  streamId?: string;
}

export class VerticalDiffHandler implements vscode.Disposable {
  public insertedInCurrentBlock = 0;
  public streamId?: string;
  disposables: vscode.Disposable[] = [];
  private currentLineIndex: number;
  private cancelled = false;
  private newLinesAdded = 0;
  private deletionBuffer: string[] = [];
  private removedLineDecorations: RemovedLineDecorationManager;
  private addedLineDecorations: AddedLineDecorationManager;
  private _diffLinesQueue: DiffLine[] = [];
  private _queueLock = false;

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
    this.streamId = options.streamId;

    this.removedLineDecorations = new RemovedLineDecorationManager(this.editor);
    this.addedLineDecorations = new AddedLineDecorationManager(this.editor);

    const disposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) {
        return;
      }
      // When we switch away and back to this editor, need to re-draw decorations
      if (URI.equal(editor.document.uri.toString(), this.fileUri)) {
        this.editor = editor;
        this.removedLineDecorations.applyToNewEditor(editor);
        this.addedLineDecorations.applyToNewEditor(editor);
        this.updateIndexLineDecorations();
        this.refreshCodeLens();

        // Handle any lines received while editor was closed
        this.queueDiffLine(undefined);
      }
    });
    this.disposables.push(disposable);
  }

  /**  ensures the current target file is open and focused before performing edits*/
  private async ensureCurrentFileIsFocused() {
    const targetUri = this.editor.document.uri;
    const active = vscode.window.activeTextEditor;
    if (
      active &&
      URI.equal(active.document.uri.toString(), targetUri.toString())
    ) {
      this.editor = active;
      return;
    }

    const visible = vscode.window.visibleTextEditors.find((foundEditor) =>
      URI.equal(foundEditor.document.uri.toString(), targetUri.toString()),
    );
    if (visible) {
      await vscode.window.showTextDocument(visible.document, {
        preview: false,
        preserveFocus: false,
        viewColumn: visible.viewColumn,
      });
      this.editor = vscode.window.activeTextEditor ?? visible;
      return;
    }

    const doc = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(doc, {
      preview: false,
      preserveFocus: false,
    });
    this.editor = editor;
  }

  public get range(): vscode.Range {
    const startLine = Math.min(this.startLine, this.endLine);
    const endLine = Math.max(this.startLine, this.endLine);
    return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
  }

  get isCancelled() {
    return this.cancelled;
  }

  private get fileUri() {
    return this.editor.document.uri.toString();
  }

  async clear(accept: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      false,
    );

    const removedRanges = this.removedLineDecorations.ranges;
    if (accept) {
      // Accept all: delete all the red ranges and clear green decorations
      await this.deleteRangeLines(removedRanges.map((r) => r.range));
    } else {
      await this.unifiedRejectAll();
    }

    this.clearDecorations();

    this.options.onStatusUpdate(
      "closed",
      this.editorToVerticalDiffCodeLens.get(this.fileUri)?.length ?? 0,
      this.editor.document.getText(),
    );

    this.cancelled = true;
    this.refreshCodeLens();
    this.dispose();
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }

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

      const myersDiffs = await this.reapplyWithMyersDiff(diffLines);

      // Scroll to the first diff
      const scrollToLine =
        getFirstChangedLine(myersDiffs, this.startLine) ?? this.startLine;
      const range = new vscode.Range(scrollToLine, 0, scrollToLine, 0);
      this.editor.revealRange(range, vscode.TextEditorRevealType.Default);

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
      this.addedLineDecorations.deleteRangeStartingAt(startLine + numRed);
      if (!accept) {
        // Delete the actual lines
        await this.deleteLinesAt(startLine + numRed, numGreen);
      }
    }

    if (numRed > 0) {
      const deleted =
        this.removedLineDecorations.deleteRangesStartingAt(startLine);

      await this.deleteLinesAt(startLine, numRed);
      if (deleted && !accept) {
        await this.insertTextAboveLine(
          startLine,
          deleted.map((r) => r.line).join("\n"),
        );
      }
    }

    // Shift everything below upward
    const offset = -(accept ? numRed : numGreen);

    this.removedLineDecorations.shiftDownAfterLine(startLine, offset);
    this.addedLineDecorations.shiftDownAfterLine(startLine, offset);

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

    // Update decorations
    this.removedLineDecorations.shiftDownAfterLine(startLine, lineDelta);
    this.addedLineDecorations.shiftDownAfterLine(startLine, lineDelta);

    // Update code lens
    this.shiftCodeLensObjects(startLine, lineDelta);
  }

  public hasDiffForCurrentFile(): boolean {
    const diffBlocks = this.editorToVerticalDiffCodeLens.get(this.fileUri);
    return diffBlocks !== undefined && diffBlocks.length > 0;
  }

  clearDecorations() {
    this.removedLineDecorations.clear();
    this.addedLineDecorations.clear();
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

    await this.ensureCurrentFileIsFocused();

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
    // We need the input to be "newline terminated" rather than
    // newline separated, because myersDiff() would consider
    // ["A"] => "A" and ["A", ""] => "A\n" to be the same single line.
    // "A\n" and "A\n\n" are unambiguous.
    const oldContentWithoutTrailingNewline = diffLines
      .filter((line) => line.type === "same" || line.type === "old")
      .map((line) => line.line)
      .join("\n");

    const oldFileContent = oldContentWithoutTrailingNewline + "\n";

    const newFileContent =
      diffLines
        .filter((line) => line.type === "same" || line.type === "new")
        .map((line) => line.line)
        .join("\n") + "\n";

    const myersDiffs = myersDiff(oldFileContent, newFileContent);

    // Preserve the trailing newline behavior by checking the original document content
    const originalDocumentContent = this.editor.document.getText(this.range);
    const originalContentEndsWithNewline =
      originalDocumentContent.endsWith("\n");

    // Add trailing newline only if the original file had one to prevent line count discrepancies
    const replaceContent =
      myersDiffs
        .map((diff) => (diff.type === "old" ? "" : diff.line))
        .join("\n") + (originalContentEndsWithNewline ? "\n" : "");

    // Then, we insert our diff lines
    await this.editor.edit((editBuilder) => {
      editBuilder.replace(this.range, replaceContent),
        { undoStopAfter: false, undoStopBefore: false };
    });

    // Lastly, we apply decorations
    let numRed = 0;
    let numGreen = 0;

    const codeLensBlocks: VerticalDiffCodeLens[] = [];

    myersDiffs.forEach((diff, index) => {
      if (diff.type === "old") {
        this.removedLineDecorations.addLine(this.startLine + index, diff.line);
        numRed++;
      } else if (diff.type === "new") {
        this.addedLineDecorations.addLine(this.startLine + index);
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
        start: this.startLine + myersDiffs.length - numRed - numGreen,
      });
    }

    this.editorToVerticalDiffCodeLens.set(this.fileUri, codeLensBlocks);
    this.refreshCodeLens();

    return myersDiffs;
  }

  private async insertDeletionBuffer() {
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

    // Insert the block of deleted lines as empty new lines
    await this.insertTextAboveLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      "\n".repeat(this.deletionBuffer.length - 1),
    );

    this.removedLineDecorations.addLines(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer,
    );

    // Shift green decorations downward
    this.addedLineDecorations.shiftDownAfterLine(
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
    const range = new vscode.Range(
      this.currentLineIndex,
      0,
      this.currentLineIndex,
      0,
    );
    this.editor.revealRange(range, vscode.TextEditorRevealType.Default);
  }

  private async insertTextAboveLine(index: number, text: string) {
    await this.ensureCurrentFileIsFocused();
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
      { undoStopAfter: false, undoStopBefore: false },
    );
  }

  private async insertLineAboveIndex(index: number, line: string) {
    await this.insertTextAboveLine(index, line);
    this.addedLineDecorations.addLine(index);
    this.newLinesAdded++;
  }

  private async deleteLinesAt(index: number, numLines = 1) {
    const startLine = new vscode.Position(index, 0);
    await this.ensureCurrentFileIsFocused();
    await this.editor.edit(
      (editBuilder) => {
        editBuilder.delete(
          new vscode.Range(startLine, startLine.translate(numLines)),
        );
      },
      { undoStopAfter: false, undoStopBefore: false },
    );
  }

  private async deleteRangeLines(ranges: vscode.Range[]) {
    await this.ensureCurrentFileIsFocused();
    await this.editor.edit(
      (editBuilder) => {
        for (const range of ranges) {
          editBuilder.delete(
            new vscode.Range(
              range.start,
              new vscode.Position(range.end.line + 1, 0),
            ),
          );
        }
      },
      { undoStopAfter: false, undoStopBefore: false },
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

  /**
   * Rejects all diffs in a single edit operation.
   */
  private async unifiedRejectAll() {
    await this.ensureCurrentFileIsFocused();

    const removedRanges = this.removedLineDecorations.ranges;
    const addedRanges = this.addedLineDecorations.ranges;

    interface LineOperation {
      type: "removed" | "added";
      line?: string; // Only for removed lines
      range: vscode.Range;
    }

    const operations: LineOperation[] = [];
    for (const r of removedRanges) {
      operations.push({
        type: "removed",
        line: r.line,
        range: r.range,
      });
    }
    for (const range of addedRanges) {
      operations.push({
        type: "added",
        range,
      });
    }

    operations.sort((a, b) => b.range.start.line - a.range.start.line);

    const document = this.editor.document;
    const lines = document.getText().split("\n");

    for (const op of operations) {
      const lineNum = op.range.start.line;

      if (op.type === "removed") {
        // Replace the placeholder line with the original content
        lines[lineNum] = op.line!;
      } else if (op.type === "added") {
        // Delete the added lines
        const startLine = op.range.start.line;
        const endLine = op.range.end.line;
        const numLinesToDelete = endLine - startLine + 1;
        lines.splice(startLine, numLinesToDelete);
      }
    }

    const finalContent = lines.join("\n");

    await this.editor.edit(
      (editBuilder) => {
        const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
        editBuilder.replace(fullRange, finalContent);
      },
      { undoStopAfter: false, undoStopBefore: false },
    );
  }
}
