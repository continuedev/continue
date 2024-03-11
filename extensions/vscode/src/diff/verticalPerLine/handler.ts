import { DiffLine } from "core";
import * as vscode from "vscode";
import {
  DecorationTypeRangeManager,
  belowIndexDecorationType,
  greenDecorationType,
  indexDecorationType,
  redDecorationType,
} from "./decorations";
import { VerticalDiffCodeLens } from "./manager";

export class VerticalPerLineDiffHandler {
  private editor: vscode.TextEditor;
  private startLine: number;
  private endLine: number;
  private currentLineIndex: number;
  private cancelled: boolean = false;

  public get range(): vscode.Range {
    const startLine = Math.min(this.startLine, this.endLine);
    const endLine = Math.max(this.startLine, this.endLine);
    return new vscode.Range(startLine, 0, endLine, Number.MAX_SAFE_INTEGER);
  }

  private newLinesAdded: number = 0;

  public input?: string;

  constructor(
    startLine: number,
    endLine: number,
    editor: vscode.TextEditor,
    private readonly editorToVerticalDiffCodeLens: Map<
      string,
      VerticalDiffCodeLens[]
    >,
    private readonly clearForFilepath: (
      filepath: string | undefined,
      accept: boolean,
    ) => void,
    input?: string,
  ) {
    this.currentLineIndex = startLine;
    this.startLine = startLine;
    this.endLine = endLine;
    this.editor = editor;
    this.input = input;

    this.redDecorationManager = new DecorationTypeRangeManager(
      redDecorationType,
      this.editor,
    );
    this.greenDecorationManager = new DecorationTypeRangeManager(
      greenDecorationType,
      this.editor,
    );
  }

  private get filepath() {
    return this.editor.document.uri.fsPath;
  }

  private deletionBuffer: string[] = [];
  private redDecorationManager: DecorationTypeRangeManager;
  insertedInCurrentBlock = 0;

  private async insertDeletionBuffer() {
    // Don't remove trailing whitespace line
    const totalDeletedContent = this.deletionBuffer.join("\n");
    if (
      totalDeletedContent === "" &&
      this.currentLineIndex >= this.endLine + this.newLinesAdded &&
      this.insertedInCurrentBlock === 0
    ) {
      return;
    }

    if (this.deletionBuffer.length || this.insertedInCurrentBlock > 0) {
      const blocks = this.editorToVerticalDiffCodeLens.get(this.filepath) || [];
      blocks.push({
        start: this.currentLineIndex - this.insertedInCurrentBlock,
        numRed: this.deletionBuffer.length,
        numGreen: this.insertedInCurrentBlock,
      });
      this.editorToVerticalDiffCodeLens.set(this.filepath, blocks);
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
  }

  private incrementCurrentLineIndex() {
    this.currentLineIndex++;
    this.updateIndexLineDecorations();
  }

  private greenDecorationManager: DecorationTypeRangeManager;

  private async insertTextAboveLine(index: number, text: string) {
    await this.editor.edit((editBuilder) => {
      const lineCount = this.editor.document.lineCount;
      if (index >= lineCount) {
        // Append to end of file
        editBuilder.insert(
          new vscode.Position(
            lineCount,
            this.editor.document.lineAt(lineCount - 1).text.length,
          ),
          "\n" + text,
        );
      } else {
        editBuilder.insert(new vscode.Position(index, 0), text + "\n");
      }
    });
  }

  private async insertLineAboveIndex(index: number, line: string) {
    await this.insertTextAboveLine(index, line);
    this.greenDecorationManager.addLine(index);
    this.newLinesAdded++;
  }

  private async deleteLinesAt(index: number, numLines: number = 1) {
    const startLine = new vscode.Position(index, 0);
    await this.editor.edit((editBuilder) => {
      editBuilder.delete(
        new vscode.Range(startLine, startLine.translate(numLines)),
      );
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

  clear(accept: boolean) {
    vscode.commands.executeCommand(
      "setContext",
      "continue.streamingDiff",
      false,
    );
    const rangesToDelete = accept
      ? this.redDecorationManager.getRanges()
      : this.greenDecorationManager.getRanges();

    this.redDecorationManager.clear();
    this.greenDecorationManager.clear();
    this.clearIndexLineDecorations();

    this.editorToVerticalDiffCodeLens.delete(this.filepath);

    this.editor.edit((editBuilder) => {
      for (const range of rangesToDelete) {
        editBuilder.delete(
          new vscode.Range(
            range.start,
            new vscode.Position(range.end.line + 1, 0),
          ),
        );
      }
    });

    this.cancelled = true;
  }

  get isCancelled() {
    return this.cancelled;
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
    try {
      // As an indicator of loading
      this.updateIndexLineDecorations();

      for await (let diffLine of diffLineGenerator) {
        if (this.isCancelled) {
          return;
        }
        await this.handleDiffLine(diffLine);
      }

      // Clear deletion buffer
      await this.insertDeletionBuffer();
      this.clearIndexLineDecorations();

      // Reject on user typing
      // const listener = vscode.workspace.onDidChangeTextDocument((e) => {
      //   if (e.document.uri.fsPath === this.filepath) {
      //     this.clear(false);
      //     listener.dispose();
      //   }
      // });
    } catch (e) {
      this.clearForFilepath(this.filepath, false);
      throw e;
    }
  }

  async acceptRejectBlock(
    accept: boolean,
    startLine: number,
    numGreen: number,
    numRed: number,
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
    const blocks =
      this.editorToVerticalDiffCodeLens
        .get(this.filepath)
        ?.filter((x) => x.start !== startLine)
        .map((x) => {
          if (x.start > startLine) {
            return { ...x, start: x.start + offset };
          }
          return x;
        }) || [];
    this.editorToVerticalDiffCodeLens.set(this.filepath, blocks);
  }
}
