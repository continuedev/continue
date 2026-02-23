/**
 * Utility functions for working with markdown files and code blocks
 */

/**
 * Determines if a code block header indicates markdown content
 */
export function headerIsMarkdown(header: string): boolean {
  return (
    header === "md" ||
    header === "markdown" ||
    header === "gfm" ||
    header === "github-markdown" ||
    header.includes(" md") ||
    header.includes(" markdown") ||
    header.includes(" gfm") ||
    header.includes(" github-markdown") ||
    header.split(" ")[0]?.split(".").pop() === "md" ||
    header.split(" ")[0]?.split(".").pop() === "markdown" ||
    header.split(" ")[0]?.split(".").pop() === "gfm"
  );
}

/**
 * Determines if a file is a markdown file based on its filepath.
 */
export function isMarkdownFile(filepath?: string): boolean {
  if (!filepath) {
    return false;
  }

  const ext = filepath.split(".").pop()?.toLowerCase() || "";
  return ["md", "markdown", "gfm"].includes(ext);
}

/**
 * State tracker for markdown block analysis to avoid recomputing on each call.
 * Optimized to handle nested markdown code blocks.
 */
export class MarkdownBlockStateTracker {
  protected trimmedLines: string[];
  protected bareBacktickPositions: number[];
  private markdownNestCount: number = 0;
  private lastProcessedIndex: number = -1;

  constructor(allLines: string[]) {
    this.trimmedLines = allLines.map((l) => l.trim());
    // Pre-compute positions of all bare backtick lines for faster lookup
    this.bareBacktickPositions = [];
    for (let i = 0; i < this.trimmedLines.length; i++) {
      if (this.trimmedLines[i].match(/^`+$/)) {
        this.bareBacktickPositions.push(i);
      }
    }
  }

  /**
   * Determines if we should stop at the given markdown block position.
   * Maintains state across calls to avoid redundant computation.
   */
  shouldStopAtPosition(currentIndex: number): boolean {
    if (this.trimmedLines[currentIndex] !== "```") {
      return false;
    }

    // Process any lines we haven't seen yet up to currentIndex
    for (let j = this.lastProcessedIndex + 1; j <= currentIndex; j++) {
      const currentLine = this.trimmedLines[j];

      if (this.markdownNestCount > 0) {
        // Inside a markdown block
        if (currentLine.match(/^`+$/)) {
          // Found bare backticks - check if this is the last one
          if (j === currentIndex) {
            const remainingBareBackticks =
              this.getRemainingBareBackticksAfter(j);
            if (remainingBareBackticks === 0) {
              this.markdownNestCount = 0;
              this.lastProcessedIndex = j;
              return true;
            }
          }
        } else if (currentLine.startsWith("```")) {
          // Going into a nested codeblock
          this.markdownNestCount++;
        }
      } else {
        // Not inside a markdown block yet
        if (currentLine.startsWith("```")) {
          const header = currentLine.replaceAll("`", "");
          if (headerIsMarkdown(header)) {
            this.markdownNestCount = 1;
          }
        }
      }
    }

    this.lastProcessedIndex = currentIndex;
    return false;
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

/**
 * Collects all lines from a LineStream into an array for analysis.
 */
export async function collectAllLines<T>(
  stream: AsyncGenerator<T>,
): Promise<T[]> {
  const allLines: T[] = [];
  for await (const line of stream) {
    allLines.push(line);
  }
  return allLines;
}
