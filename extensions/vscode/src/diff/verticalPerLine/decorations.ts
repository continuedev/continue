import * as vscode from "vscode";

export const redDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(255, 0, 0, 0.2)",
  color: "rgb(200, 200, 200)",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

export const greenDecorationType = vscode.window.createTextEditorDecorationType(
  {
    isWholeLine: true,
    backgroundColor: "rgba(0, 255, 0, 0.2)",
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  },
);

export const indexDecorationType = vscode.window.createTextEditorDecorationType(
  {
    isWholeLine: true,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  },
);
export const belowIndexDecorationType =
  vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

export class DecorationTypeRangeManager {
  private decorationType: vscode.TextEditorDecorationType;
  private editor: vscode.TextEditor;

  constructor(
    decorationType: vscode.TextEditorDecorationType,
    editor: vscode.TextEditor,
  ) {
    this.decorationType = decorationType;
    this.editor = editor;
  }

  private ranges: vscode.Range[] = [];

  addLines(startIndex: number, numLines: number) {
    const lastRange = this.ranges[this.ranges.length - 1];
    if (lastRange && lastRange.end.line === startIndex - 1) {
      this.ranges[this.ranges.length - 1] = lastRange.with(
        undefined,
        lastRange.end.translate(numLines),
      );
    } else {
      this.ranges.push(
        new vscode.Range(
          startIndex,
          0,
          startIndex + numLines - 1,
          Number.MAX_SAFE_INTEGER,
        ),
      );
    }

    this.editor.setDecorations(this.decorationType, this.ranges);
  }

  addLine(index: number) {
    this.addLines(index, 1);
  }

  clear() {
    this.ranges = [];
    this.editor.setDecorations(this.decorationType, this.ranges);
  }

  getRanges() {
    return this.ranges;
  }

  private translateRange(
    range: vscode.Range,
    lineOffset: number,
  ): vscode.Range {
    return new vscode.Range(
      range.start.translate(lineOffset),
      range.end.translate(lineOffset),
    );
  }

  shiftDownAfterLine(afterLine: number, offset: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].start.line >= afterLine) {
        this.ranges[i] = this.translateRange(this.ranges[i], offset);
      }
    }
    this.editor.setDecorations(this.decorationType, this.ranges);
  }

  deleteRangeStartingAt(line: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].start.line === line) {
        return this.ranges.splice(i, 1)[0];
      }
    }
  }
}
