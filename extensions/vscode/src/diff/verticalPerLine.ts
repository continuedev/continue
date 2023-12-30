import { DiffLine } from "core/diff/diffLines";

class VerticalPerLineDiffHandler {
  private startLine: number;
  private endLine: number;
  private currentLineIndex: number;

  constructor(startLine: number, endLine: number) {
    this.startLine = startLine;
    this.endLine = endLine;
    this.currentLineIndex = startLine;
  }

  async *displayVerticalPerLineDiff(
    diffLineGenerator: AsyncGenerator<DiffLine>
  ) {
    for await (const diffLine of diffLineGenerator) {
      this.handleDiffLine(diffLine);
    }
  }

  handleDiffLine(diffLine: DiffLine) {
    switch (diffLine.type) {
      case "same":
        this.currentLineIndex++;
        break;
      case "old":
        this.setLineAtIndexRed(this.currentLineIndex);
        this.currentLineIndex++;
        break;
      case "new":
        break;
    }

    this.updateIndexLineDecorations();
  }

  setLineAtIndexRed(index: number) {}

  updateIndexLineDecorations() {
    // Highlight the line at the currentLineIndex
    // And lightly highlight all lines between that and endLine
  }
}
