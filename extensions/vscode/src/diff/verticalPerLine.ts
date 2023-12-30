import { DiffLine } from "core";
import { streamDiffLines } from "core/commands/slash/verticalEdit";
import * as vscode from "vscode";
import { llmFromTitle } from "../loadConfig";

const redDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(255, 0, 0, 0.2)",
  color: "white",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const greenDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(0, 255, 0, 0.2)",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

const indexDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(255, 255, 255, 0.2)",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});
const belowIndexDecorationType = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
});

class DecorationTypeRangeManager {
  private decorationType: vscode.TextEditorDecorationType;
  private editor: vscode.TextEditor;

  constructor(
    decorationType: vscode.TextEditorDecorationType,
    editor: vscode.TextEditor
  ) {
    this.decorationType = decorationType;
    this.editor = editor;
  }

  private ranges: vscode.Range[] = [];

  addLine(index: number) {
    const lastRange = this.ranges[this.ranges.length - 1];
    if (lastRange && lastRange.end.line === index - 1) {
      this.ranges[this.ranges.length - 1] = lastRange.with(
        undefined,
        lastRange.end.translate(1)
      );
    } else {
      this.ranges.push(
        new vscode.Range(index, 0, index, Number.MAX_SAFE_INTEGER)
      );
    }

    this.editor.setDecorations(this.decorationType, this.ranges);
  }

  clear() {
    this.ranges = [];
    this.editor.setDecorations(this.decorationType, this.ranges);
  }

  getRanges() {
    return this.ranges;
  }
}

export class VerticalPerLineDiffHandler {
  private editor: vscode.TextEditor;
  private endLine: number;
  private currentLineIndex: number;

  constructor(startLine: number, endLine: number, editor: vscode.TextEditor) {
    this.currentLineIndex = startLine;
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
  }

  async handleDiffLine(diffLine: DiffLine) {
    switch (diffLine.type) {
      case "same":
        break;
      case "old":
        this.setLineAtIndexRed(this.currentLineIndex);
        break;
      case "new":
        await this.insertLineAboveIndex(this.currentLineIndex, diffLine.line);
        break;
    }
    this.incrementCurrentLineIndex();
  }

  private incrementCurrentLineIndex() {
    this.currentLineIndex++;
    this.updateIndexLineDecorations();
  }

  /* Decorations */
  private redDecorationManager: DecorationTypeRangeManager;
  private greenDecorationManager: DecorationTypeRangeManager;

  private setLineAtIndexRed(index: number) {
    this.redDecorationManager.addLine(index);
  }

  async insertLineAboveIndex(index: number, line: string) {
    await this.editor.edit((editBuilder) => {
      editBuilder.insert(new vscode.Position(index, 0), line + "\n");
    });
    this.greenDecorationManager.addLine(index);
  }

  private updateIndexLineDecorations() {
    // Highlight the line at the currentLineIndex
    // And lightly highlight all lines between that and endLine
    if (
      this.currentLineIndex >= this.editor.document.getText().split("\n").length
    ) {
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
        new vscode.Range(start.translate(1), end),
      ]);
    }
  }
}

class VerticalPerLineDiffManager {
  private filepathToEditorMap: Map<string, VerticalPerLineDiffHandler> =
    new Map();

  getOrCreateVerticalPerLineDiffHandler(
    filepath: string,
    startLine: number,
    endLine: number
  ) {
    if (this.filepathToEditorMap.has(filepath)) {
      return this.filepathToEditorMap.get(filepath)!;
    } else {
      const editor = vscode.window.activeTextEditor; // TODO
      if (editor && editor.document.uri.fsPath === filepath) {
        const handler = new VerticalPerLineDiffHandler(
          startLine,
          endLine,
          editor
        );
        this.filepathToEditorMap.set(filepath, handler);
        return handler;
      } else {
        return undefined;
      }
    }
  }

  clearForFilepath(filepath: string | undefined, accept: boolean) {
    if (!filepath) {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      filepath = activeEditor.document.uri.fsPath;
    }

    const handler = this.filepathToEditorMap.get(filepath);
    if (handler) {
      handler.clear(accept);
      this.filepathToEditorMap.delete(filepath);
    }
  }
}

export const verticalPerLineDiffManager = new VerticalPerLineDiffManager();

export async function streamEdit(input: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const filepath = editor.document.uri.fsPath;
  const startLine = editor.selection.start.line;
  const endLine = editor.selection.end.line;

  const diffHandler =
    verticalPerLineDiffManager.getOrCreateVerticalPerLineDiffHandler(
      filepath,
      startLine,
      endLine
    );

  if (diffHandler) {
    const selectedRange = new vscode.Range(
      editor.selection.start,
      editor.selection.end
    );
    const rangeContent = editor.document.getText(selectedRange);
    const llm = await llmFromTitle();

    for await (const diffLine of streamDiffLines(
      rangeContent.split("\n"),
      llm,
      input
    )) {
      // console.log(
      //   (diffLine.type === "new"
      //     ? "+ "
      //     : diffLine.type === "old"
      //     ? "- "
      //     : "  ") + diffLine.line
      // );
      await diffHandler.handleDiffLine(diffLine);
    }
  }

  // Shortcuts to accept / reject
}
