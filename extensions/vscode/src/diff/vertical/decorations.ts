import * as vscode from "vscode";

const removedLineDecorationType = (line: string) =>
  vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: { id: "diffEditor.removedLineBackground" },
    // color: "#808080",
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: { id: "diffEditor.removedTextBorder" },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    after: {
      contentText: line,
      color: "#808080",
      textDecoration: "none; white-space: pre",
    },
    textDecoration: "none; display: none",
  });

const addedLineDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: { id: "diffEditor.insertedLineBackground" },
  outlineWidth: "1px",
  outlineStyle: "solid",
  outlineColor: { id: "diffEditor.insertedTextBorder" },
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

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

function translateRange(range: vscode.Range, lineOffset: number): vscode.Range {
  return new vscode.Range(
    range.start.translate(lineOffset),
    range.end.translate(lineOffset),
  );
}

export class AddedLineDecorationManager {
  constructor(private editor: vscode.TextEditor) {}

  private ranges: vscode.Range[] = [];
  decorationType = addedLineDecorationType;

  applyToNewEditor(newEditor: vscode.TextEditor) {
    this.editor = newEditor;
    this.editor.setDecorations(this.decorationType, this.ranges);
  }

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

  shiftDownAfterLine(afterLine: number, offset: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].start.line >= afterLine) {
        this.ranges[i] = translateRange(this.ranges[i], offset);
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
    this.editor.setDecorations(this.decorationType, this.ranges);
  }
}

export class RemovedLineDecorationManager {
  constructor(private editor: vscode.TextEditor) {}

  private ranges: {
    line: string;
    range: vscode.Range;
    decoration: vscode.TextEditorDecorationType;
  }[] = [];

  applyToNewEditor(newEditor: vscode.TextEditor) {
    this.editor = newEditor;
    this.applyDecorations();
  }

  addLines(startIndex: number, lines: string[]) {
    let i = 0;
    for (const line of lines) {
      this.ranges.push({
        line,
        range: new vscode.Range(
          startIndex + i,
          0,
          startIndex + i,
          Number.MAX_SAFE_INTEGER,
        ),
        decoration: removedLineDecorationType(line),
      });
      i++;
    }
    this.applyDecorations();
  }

  addLine(index: number, line: string) {
    this.addLines(index, [line]);
  }

  applyDecorations() {
    this.ranges.forEach((r) => {
      this.editor.setDecorations(r.decoration, [r.range]);
    });
  }

  // Red decorations are always unique, so we'll always dispose
  clear() {
    this.ranges.forEach((r) => {
      r.decoration.dispose();
    });
    this.ranges = [];
  }

  getRanges() {
    return this.ranges;
  }

  shiftDownAfterLine(afterLine: number, offset: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].range.start.line >= afterLine) {
        this.ranges[i].range = translateRange(this.ranges[i].range, offset);
      }
    }
    this.applyDecorations();
  }

  // Red ranges are always single-line, so to delete group, delete sequential ranges
  deleteRangesStartingAt(line: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].range.start.line === line) {
        this.ranges[i].decoration.dispose();
        // Find how many sequential ranges we have starting from this line
        let count = 1;
        while (
          i + count < this.ranges.length &&
          this.ranges[i + count].range.start.line === line + count
        ) {
          count++;
          this.ranges[i + count].decoration.dispose();
        }
        // Remove all sequential ranges and return them
        return this.ranges.splice(i, count);
      }
    }
  }
}
