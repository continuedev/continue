import { DiffLine } from "core";
import * as vscode from "vscode";
import {
  DecorationTypeRangeManager,
  belowIndexDecorationType,
  greenDecorationType,
  indexDecorationType,
  redDecorationType,
} from "./decorations";

export class VerticalPerLineDiffHandler {
  private editor: vscode.TextEditor;
  private startLine: number;
  private endLine: number;
  private currentLineIndex: number;
  private cancelled: boolean = false;

  private newLinesAdded: number = 0;

  constructor(startLine: number, endLine: number, editor: vscode.TextEditor) {
    this.currentLineIndex = startLine;
    this.startLine = startLine;
    this.endLine = endLine;
    this.editor = editor;

    this.redDecorationManager = new DecorationTypeRangeManager(
      redDecorationType,
      this.editor
    );
    this.greenDecorationManager = new DecorationTypeRangeManager(
      greenDecorationType,
      this.editor
    );
  }

  clear(accept: boolean) {
    const rangesToDelete = accept
      ? this.redDecorationManager.getRanges()
      : this.greenDecorationManager.getRanges();

    this.redDecorationManager.clear();
    this.greenDecorationManager.clear();
    this.clearIndexLineDecorations();

    this.editor.edit((editBuilder) => {
      for (const range of rangesToDelete) {
        editBuilder.delete(
          new vscode.Range(
            range.start,
            new vscode.Position(range.end.line + 1, 0)
          )
        );
      }
    });

    this.cancelled = true;
  }

  get isCancelled() {
    return this.cancelled;
  }

  private deletionBuffer: string[] = [];
  private redDecorationManager: DecorationTypeRangeManager;
  insertedInCurrentBlock = 0;

  private async insertDeletionBuffer() {
    if (this.deletionBuffer.length === 0) {
      this.insertedInCurrentBlock = 0;
      return;
    }

    // Insert the block of deleted lines
    const totalDeletedContent = this.deletionBuffer.join("\n");
    // Don't remove trailing whitespace line
    if (
      totalDeletedContent === "" &&
      this.currentLineIndex >= this.endLine + this.newLinesAdded
    ) {
      return;
    }

    await this.insertTextAboveLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      totalDeletedContent
    );
    this.redDecorationManager.addLines(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length
    );
    // Shift green decorations downward
    this.greenDecorationManager.shiftDownAfterLine(
      this.currentLineIndex - this.insertedInCurrentBlock,
      this.deletionBuffer.length
    );

    // Update line index, clear buffer
    for (let i = 0; i < this.deletionBuffer.length; i++) {
      this.incrementCurrentLineIndex();
    }
    this.deletionBuffer = [];
    this.insertedInCurrentBlock = 0;
  }

  async handleDiffLine(diffLine: DiffLine) {
    switch (diffLine.type) {
      case "same":
        await this.insertDeletionBuffer();
        this.incrementCurrentLineIndex();
        break;
      case "old":
        // Add to deletion buffer and delete the line for now
        this.deletionBuffer.push(diffLine.line);
        await this.deleteLineAt(this.currentLineIndex);
        break;
      case "new":
        await this.insertLineAboveIndex(this.currentLineIndex, diffLine.line);
        this.incrementCurrentLineIndex();
        this.insertedInCurrentBlock++;
        break;
    }
  }

  async run(diffLineGenerator: AsyncGenerator<DiffLine>) {
    // As an indicator of loading
    this.updateIndexLineDecorations();

    for await (let diffLine of diffLineGenerator) {
      if (this.isCancelled) {
        return;
      }
      await this.handleDiffLine(diffLine);
    }

    // Clear deletion buffer (deletion of end of range)
    if (this.deletionBuffer.length) {
      await this.insertDeletionBuffer();
    }
  }

  private incrementCurrentLineIndex() {
    this.currentLineIndex++;
    this.updateIndexLineDecorations();
  }

  private greenDecorationManager: DecorationTypeRangeManager;

  private async insertTextAboveLine(index: number, text: string) {
    await this.editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(index, 0), text + "\n");
    });
  }

  async insertLineAboveIndex(index: number, line: string) {
    await this.insertTextAboveLine(index, line);
    this.greenDecorationManager.addLine(index);
    this.newLinesAdded++;
  }

  async deleteLineAt(index: number) {
    const line = new vscode.Position(index, 0);
    await this.editor.edit((editBuilder) => {
      editBuilder.delete(new vscode.Range(line, line.translate(1)));
    });
  }

  private updateIndexLineDecorations() {
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
          new vscode.Position(start.line, Number.MAX_SAFE_INTEGER)
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
}
