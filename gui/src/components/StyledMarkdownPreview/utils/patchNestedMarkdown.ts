/*
    This is a patch for outputing markdown code that contains codeblocks

    It notices markdown blocks (including GitHub-specific variants),
    keeps track of when that specific block is closed,
    and uses ~~~ instead of ``` for that block

    Note, this was benchmarked at sub-millisecond
*/
import { headerIsMarkdown } from "./headerIsMarkdown";

/**
 * Optimized state tracker for markdown patch operations to avoid recomputing on each call.
 */
class MarkdownPatchStateTracker {
  private trimmedLines: string[];
  private bareBacktickPositions: number[];

  constructor(lines: string[]) {
    this.trimmedLines = lines.map((l) => l.trim());
    // Pre-compute positions of all bare backtick lines for faster lookup
    this.bareBacktickPositions = [];
    for (let i = 0; i < this.trimmedLines.length; i++) {
      if (this.trimmedLines[i].match(/^`+$/)) {
        this.bareBacktickPositions.push(i);
      }
    }
  }

  /**
   * Efficiently determines if there are remaining bare backticks after the given position.
   */
  getRemainingBareBackticksAfter(currentIndex: number): number {
    return this.bareBacktickPositions.filter((pos) => pos > currentIndex)
      .length;
  }

  /**
   * Checks if the line at the given index is a bare backtick line.
   */
  isBareBacktickLine(index: number): boolean {
    return this.bareBacktickPositions.includes(index);
  }

  /**
   * Gets the trimmed lines array.
   */
  getTrimmedLines(): string[] {
    return this.trimmedLines;
  }
}

export const patchNestedMarkdown = (source: string): string => {
  // Early return if no markdown codeblock pattern is found (including GitHub variants)
  if (!source.match(/```(\w*|.*)(md|markdown|gfm|github-markdown)/))
    return source;

  let nestCount = 0;
  const lines = source.split("\n");

  // Use optimized state tracker for efficient bare backtick analysis
  const stateTracker = new MarkdownPatchStateTracker(lines);
  const trimmedLines = stateTracker.getTrimmedLines();

  for (let i = 0; i < trimmedLines.length; i++) {
    const line = trimmedLines[i];

    if (nestCount > 0) {
      // Inside a markdown block
      if (stateTracker.isBareBacktickLine(i)) {
        // Found bare backticks - use optimized lookup for remaining count
        const remainingBareBackticks =
          stateTracker.getRemainingBareBackticksAfter(i);

        // If this is the last bare backticks, it closes the markdown block
        if (remainingBareBackticks === 0) {
          nestCount = 0;
          lines[i] = "~~~"; // Convert final closing delimiter to tildes
        }
        // Otherwise, keep as backticks (inner nested block delimiter)
      } else if (line.startsWith("```")) {
        // Going into a nested codeblock (with language identifier)
        nestCount++;
      }
    } else {
      // Not inside a markdown block yet
      if (line.startsWith("```")) {
        const header = line.replaceAll("`", "");

        // Check if this is a markdown codeblock using a consolidated approach (including GitHub-specific variants)
        const isMarkdown = headerIsMarkdown(header);

        if (isMarkdown) {
          nestCount = 1;
          lines[i] = lines[i].replaceAll("`", "~");
        }
      }
    }
  }

  return lines.join("\n");
};
