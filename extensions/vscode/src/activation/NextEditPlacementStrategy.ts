import { DiffLine } from "core";
// @ts-ignore
import * as vscode from "vscode";

/**
 * Describes the relevant context for deciding where to place a next-edit SVG tooltip.
 */
export interface NextEditPlacementContext {
  editor: vscode.TextEditor;
  cursorPosition: vscode.Position;
  editableRegionStartLine: number;
  editableRegionEndLine: number;
  originalCode: string;
  predictedCode: string;
  diffLines: DiffLine[];
}

/**
 * Placement decision containing the anchor line and additional padding to apply.
 */
export interface NextEditPlacementResult {
  line: number;
  padding: number;
}

/**
 * Strategy responsible for deciding where a next-edit tooltip should be rendered.
 */
export interface NextEditPlacementStrategy {
  getPlacement(context: NextEditPlacementContext): NextEditPlacementResult;
}

/**
 * Basic strategy that always renders on the cursor line without extra padding.
 */
export class SameLinePlacementStrategy
  implements NextEditPlacementStrategy
{
  public getPlacement({ cursorPosition }: NextEditPlacementContext) {
    return {
      line: cursorPosition.line,
      padding: 0,
    } satisfies NextEditPlacementResult;
  }
}

export interface ViewportAwarePlacementStrategyOptions {
  fallbackMaxLineLength?: number;
  searchRadius?: number;
  minPadding?: number;
  maxPadding?: number;
  paddingBuffer?: number;
}

const DEFAULT_VIEWPORT_AWARE_OPTIONS: Required<ViewportAwarePlacementStrategyOptions> = {
  fallbackMaxLineLength: 100,
  searchRadius: 6,
  minPadding: 1,
  maxPadding: 6,
  paddingBuffer: 4,
};

/**
 * Chooses a nearby line with enough trailing space to keep the tooltip within the viewport.
 */
export class ViewportAwarePlacementStrategy
  implements NextEditPlacementStrategy
{
  private readonly options: Required<ViewportAwarePlacementStrategyOptions>;

  constructor(options: ViewportAwarePlacementStrategyOptions = {}) {
    this.options = { ...DEFAULT_VIEWPORT_AWARE_OPTIONS, ...options };
  }

  /**
   * Pick a line and padding that keep the tooltip near the cursor without overflowing horizontally.
   */
  public getPlacement(context: NextEditPlacementContext): NextEditPlacementResult {
    const predictedLongestLine = this.getLongestLineLength(context.predictedCode);
    const maxContentWidth = this.estimateMaxContentWidth(
      context.editor,
      predictedLongestLine,
    );

    const candidateLines = this.getCandidateLines(context);
    const candidatesWithLength = candidateLines.map((line) => ({
      line,
      length: this.getLineLength(context.editor, line),
      distance: Math.abs(line - context.cursorPosition.line),
    }));

    const fitsWithinViewport = candidatesWithLength.filter(
      ({ length }) =>
        length + predictedLongestLine + this.options.minPadding <= maxContentWidth,
    );

    const fallback =
      this.pickBestCandidate(candidatesWithLength) ??
      this.createFallbackCandidate(context);

    const target = this.pickBestCandidate(fitsWithinViewport) ?? fallback;

    const padding = this.calculatePadding(
      target.length,
      predictedLongestLine,
      maxContentWidth,
    );

    return { line: target.line, padding };
  }

  /**
   * Sort candidate lines by proximity and length, returning the best match if present.
   */
  private pickBestCandidate(
    candidates: { line: number; length: number; distance: number }[],
  ) {
    const sorted = [...candidates].sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      if (a.length !== b.length) {
        return a.length - b.length;
      }
      return a.line - b.line;
    });

    return sorted[0];
  }

  /**
   * Determine how much horizontal padding can fit without overflowing.
   */
  private calculatePadding(
    lineLength: number,
    predictedLongestLine: number,
    maxContentWidth: number,
  ): number {
    const available = maxContentWidth - (lineLength + predictedLongestLine);

    if (available <= 0) {
      return 0;
    }

    const capped = Math.min(this.options.maxPadding, available);
    return Math.max(this.options.minPadding, Math.min(capped, available));
  }

  /**
   * Gather candidate line numbers around the cursor, preferring visible lines first.
   */
  private getCandidateLines(
    context: NextEditPlacementContext,
  ): number[] {
    const visibleBounds = this.getVisibleLineBounds(context.editor);
    const candidates = this.collectLines(
      context.cursorPosition.line,
      context.editor.document.lineCount,
      visibleBounds,
      this.options.searchRadius,
    );

    if (candidates.length > 0) {
      return candidates;
    }

    return this.collectLines(
      context.cursorPosition.line,
      context.editor.document.lineCount,
      undefined,
      this.options.searchRadius,
    );
  }

  /**
   * Collect lines within the supplied radius that satisfy the optional visibility constraint.
   */
  private collectLines(
    baseLine: number,
    lineCount: number,
    visibleBounds: { start: number; end: number } | undefined,
    radius: number,
  ): number[] {
    const added = new Set<number>();
    const limit = Math.max(lineCount - 1, 0);

    for (let delta = 0; delta <= radius; delta++) {
      const up = baseLine - delta;
      const down = baseLine + delta;

      if (this.shouldIncludeLine(up, limit, visibleBounds, added)) {
        added.add(up);
      }
      if (this.shouldIncludeLine(down, limit, visibleBounds, added)) {
        added.add(down);
      }
    }

    return Array.from(added).sort((a, b) => a - b);
  }

  /**
   * Validate whether a candidate line is within range and not already considered.
   */
  private shouldIncludeLine(
    line: number,
    maxLine: number,
    visibleBounds: { start: number; end: number } | undefined,
    added: Set<number>,
  ) {
    if (line < 0 || line > maxLine || added.has(line)) {
      return false;
    }

    if (!visibleBounds) {
      return true;
    }

    return line >= visibleBounds.start && line <= visibleBounds.end;
  }

  /**
   * Compute the trimmed length of the longest line in the rendered tooltip content.
   */
  private getLongestLineLength(text: string): number {
    const lines = text.split("\n");
    return lines.reduce(
      (longest, line) => Math.max(longest, line.trimEnd().length),
      0,
    );
  }

  /**
   * Measure the trimmed length of the requested line, guarding against document churn.
   */
  private getLineLength(editor: vscode.TextEditor, line: number): number {
    try {
      return editor.document.lineAt(line).text.trimEnd().length;
    } catch (error) {
      console.error("Failed to read line for placement", error);
      return 0;
    }
  }

  /**
   * Fallback placement that keeps the tooltip attached to the cursor line.
   */
  private createFallbackCandidate(context: NextEditPlacementContext) {
    return {
      line: context.cursorPosition.line,
      length: this.getLineLength(context.editor, context.cursorPosition.line),
      distance: 0,
    };
  }

  /**
   * Estimate how much horizontal space the editor can show without clipping.
   */
  private estimateMaxContentWidth(
    editor: vscode.TextEditor,
    predictedLongestLine: number,
  ): number {
    const config = vscode.workspace.getConfiguration("editor");
    const wrapColumn = config.get<number>("wordWrapColumn") ?? 0;
    const baseWidth =
      wrapColumn > 0 ? wrapColumn : this.options.fallbackMaxLineLength;

    const minimumWidth =
      predictedLongestLine + this.options.minPadding + this.options.paddingBuffer;

    return Math.max(baseWidth - this.options.paddingBuffer, minimumWidth);
  }

  /**
   * Determine the visible line range for the active editor, if available.
   */
  private getVisibleLineBounds(editor: vscode.TextEditor) {
    if (editor.visibleRanges.length === 0) {
      return undefined;
    }

    const start = Math.min(...editor.visibleRanges.map((range) => range.start.line));
    const end = Math.max(...editor.visibleRanges.map((range) => range.end.line));

    return { start, end };
  }
}
