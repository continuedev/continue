import * as vscode from "vscode";

export const redDecorationType = (line: string) =>
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
    },
  });

export const greenDecorationType = vscode.window.createTextEditorDecorationType(
  {
    isWholeLine: true,
    backgroundColor: { id: "diffEditor.insertedLineBackground" },
    outlineWidth: "1px",
    outlineStyle: "solid",
    outlineColor: { id: "diffEditor.insertedTextBorder" },
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

function translateRange(range: vscode.Range, lineOffset: number): vscode.Range {
  return new vscode.Range(
    range.start.translate(lineOffset),
    range.end.translate(lineOffset),
  );
}

export class DecorationTypeRangeManager {
  constructor(
    private decorationType: vscode.TextEditorDecorationType,
    private editor: vscode.TextEditor,
  ) {}

  private ranges: vscode.Range[] = [];

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
  }
}

export class RedDecorationsManager {
  constructor(private editor: vscode.TextEditor) {}

  private ranges: {
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
        range: new vscode.Range(
          startIndex + i,
          0,
          startIndex + i,
          Number.MAX_SAFE_INTEGER,
        ),
        decoration: redDecorationType(line),
      });
      i++;
    }
    this.applyDecorations();
  }

  addLine(index: number, line: string) {
    this.addLines(index, [line]);
  }

  private getDecorationsMap() {
    const decorationsMap = new Map<
      vscode.TextEditorDecorationType,
      vscode.Range[]
    >();
    for (const range of this.ranges) {
      const ranges = decorationsMap.get(range.decoration) ?? [];
      ranges.push(range.range);
      decorationsMap.set(range.decoration, ranges);
    }
    return decorationsMap;
  }

  applyDecorations() {
    const decorationsMap = this.getDecorationsMap();
    for (const [decoration, ranges] of decorationsMap) {
      this.editor.setDecorations(decoration, ranges);
    }
  }

  clear() {
    const decorationsMap = this.getDecorationsMap();
    for (const [decoration, _] of decorationsMap) {
      this.editor.setDecorations(decoration, []);
    }
    this.ranges = [];
  }

  getRanges() {
    return this.ranges.map((r) => r.range);
  }

  shiftDownAfterLine(afterLine: number, offset: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].range.start.line >= afterLine) {
        this.ranges[i].range = translateRange(this.ranges[i].range, offset);
      }
    }
    this.applyDecorations();
  }

  deleteRangeStartingAt(line: number) {
    for (let i = 0; i < this.ranges.length; i++) {
      if (this.ranges[i].range.start.line === line) {
        return this.ranges.splice(i, 1)[0];
      }
    }
  }
}
