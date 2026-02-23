import { LineStream } from "../../../diff/util";

import {
  collectAllLines,
  MarkdownBlockStateTracker,
} from "../../../utils/markdownUtils";

import {
  processBlockNesting,
  shouldStopAtMarkdownBlock,
} from "../../../utils/streamMarkdownUtils";

import { hasNestedMarkdownBlocks, shouldChangeLineAndStop } from "./lineStream";

/**
 * Filters and processes lines from a code block, removing unnecessary markers and handling edge cases.
 * Now includes markdown-aware processing to handle nested markdown blocks properly.
 *
 * @param {LineStream} rawLines - The input stream of lines to filter.
 * @param {string} filepath - Optional filepath to determine if this is a markdown file.
 * @yields {string} Filtered and processed lines from the code block.
 *
 * @description
 * This generator function performs the following tasks:
 * 1. Removes initial lines that should be removed before the actual code starts.
 * 2. For markdown files, applies nested markdown block logic to avoid premature termination.
 * 3. For mixed content, uses simplified processing to avoid premature termination.
 * 4. For traditional code blocks, uses original logic.
 * 5. Yields processed lines that are part of the actual code block content.
 */
export async function* filterCodeBlockLines(
  rawLines: LineStream,
  filepath?: string,
): LineStream {
  // Collect all lines for analysis
  const allLines = await collectAllLines(rawLines);

  // Check if it has nested markdown blocks (like ```markdown or ```md)
  const firstLine = allLines[0] || "";
  const hasNestedMarkdown = hasNestedMarkdownBlocks(firstLine, filepath);

  // TARGETED FIX: Detect if this is mixed content (markdown headers + code blocks)
  // But exclude cases where we have nested markdown blocks
  const hasMarkdownHeaders = allLines.some(
    (line) => line.trim().startsWith("#") && !line.trim().startsWith("```"),
  );

  const hasCodeBlocks = allLines.some(
    (line) => line.trim().startsWith("```") && line.trim().length >= 3,
  );
  const isMixedContent =
    hasMarkdownHeaders && hasCodeBlocks && !hasNestedMarkdown;

  // If this is mixed content, use simplified processing
  if (isMixedContent) {
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];

      // Skip initial wrapper lines if they exist
      if (i === 0 && shouldRemoveLineBeforeStart(line)) {
        continue;
      }

      yield line;
    }
    return;
  }

  // Original logic for non-mixed content
  let seenFirstFence = false;
  let nestCount = 0;

  // Create optimized state tracker for markdown block analysis if needed
  let markdownStateTracker: MarkdownBlockStateTracker | undefined;
  if (hasNestedMarkdown) {
    markdownStateTracker = new MarkdownBlockStateTracker(allLines);
  }

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];

    // Process block nesting logic for the first fence
    const nesting = processBlockNesting(
      line,
      seenFirstFence,
      shouldRemoveLineBeforeStart,
    );
    if (nesting.shouldSkip) {
      continue; // Filter out starting ``` or START block
    }
    if (!seenFirstFence && nesting.newSeenFirstFence) {
      seenFirstFence = true;
      nestCount = 1;
    }

    if (nestCount > 0) {
      // Inside a block including the outer block
      const changedEndLine = shouldChangeLineAndStop(line);
      if (typeof changedEndLine === "string") {
        // Ending a block with just backticks (```) or STOP

        // For markdown files with nested markdown blocks, apply special logic
        if (
          hasNestedMarkdown &&
          line.trim() === "```" &&
          markdownStateTracker
        ) {
          if (shouldStopAtMarkdownBlock(markdownStateTracker, i)) {
            return; // Stop without yielding the final closing ```
          } else {
            // This is an inner block delimiter, yield it as content
            yield line;
            continue;
          }
        }

        // Original logic for non-markdown files or simple cases
        nestCount--;
        if (nestCount === 0) {
          // We've closed the outer wrapper - stop without yielding the closing ```
          return;
        } else {
          // This is a nested block closing, yield it as content
          yield line;
        }
      } else if (line.startsWith("```")) {
        // Going into a nested codeblock
        nestCount++;
        yield line;
      } else {
        // Otherwise just yield the line as content
        yield line;
      }
    }
  }
}

function shouldRemoveLineBeforeStart(line: string): boolean {
  return (
    line.trimStart().startsWith("```") ||
    line.trim() === "[CODE]" ||
    line.trim() === "<COMPLETION>" ||
    line.trim() === "<START EDITING HERE>" ||
    line.trim() === "{{FILL_HERE}}"
  );
}
