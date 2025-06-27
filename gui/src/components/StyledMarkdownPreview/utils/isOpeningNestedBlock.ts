import { headerIsMarkdown } from "./headerIsMarkdown";

/**
 * Determines if a line with bare backticks (```) should be treated as opening
 * a nested code block rather than closing the current block.
 *
 * Uses look-ahead to check if there are more bare backtick lines ahead,
 * which would indicate this is opening a nested block.
 *
 * @param trimmedLines - Array of trimmed lines from the source
 * @param currentIndex - Index of the current line with bare backticks
 * @param nestCount - Current nesting level
 * @returns true if this should open a nested block, false if it should close
 */
export function isOpeningNestedBlock(
  trimmedLines: string[],
  currentIndex: number,
  nestCount: number,
): boolean {
  // Simulate what would happen if we continue processing from this point
  // Count how many blocks would need to be closed vs opened

  let simulatedNestCount = nestCount;
  let bareBackticksAhead = 0;

  for (let j = currentIndex + 1; j < trimmedLines.length; j++) {
    const line = trimmedLines[j];

    // Count bare backticks lines
    if (line.match(/^`+$/)) {
      bareBackticksAhead++;
    } else if (line.startsWith("```")) {
      // Non-bare backticks (with language/type) always open
      simulatedNestCount++;
    }

    // Stop looking if we hit what appears to be the end of current markdown block
    if (nestCount === 1) {
      // At top level of markdown block - check for block terminators
      if (
        line.startsWith("~~~") ||
        (line.startsWith("```") && headerIsMarkdown(line.replaceAll("`", "")))
      ) {
        break;
      }
    }
  }

  // The key insight: if we need the current backticks to close to get back to nestCount=1,
  // and there are more bare backticks ahead than what we'd need to close everything,
  // then this should open

  if (nestCount > 1) {
    // We're deeply nested, usually should close
    return bareBackticksAhead > nestCount - 1;
  }

  // At top level (nestCount === 1), if there are exactly 2 ahead and we're at top level,
  // this suggests: current=open, first_ahead=close, second_ahead=close_markdown
  if (nestCount === 1 && bareBackticksAhead === 2) {
    return true;
  }

  // Default to the original logic
  return bareBackticksAhead % 2 === 1;
}
