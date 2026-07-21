import { LineStream } from "../diff/util";
import type { MarkdownBlockStateTracker } from "./markdownUtils";
import { isMarkdownFile } from "./markdownUtils";

/**
 * Determines if we should stop at a markdown block based on nested markdown logic.
 * This handles the complex case where markdown blocks contain other markdown blocks.
 * Uses optimized state tracking to avoid redundant computation.
 */
export function shouldStopAtMarkdownBlock(
  stateTracker: MarkdownBlockStateTracker,
  currentIndex: number,
): boolean {
  return stateTracker.shouldStopAtPosition(currentIndex);
}

/**
 * Processes block nesting logic and returns updated state.
 */
export function processBlockNesting(
  line: string,
  seenFirstFence: boolean,
  shouldRemoveLineBeforeStart: (line: string) => boolean,
): { newSeenFirstFence: boolean; shouldSkip: boolean } {
  if (!seenFirstFence && shouldRemoveLineBeforeStart(line)) {
    return { newSeenFirstFence: false, shouldSkip: true };
  }

  if (!seenFirstFence) {
    return { newSeenFirstFence: true, shouldSkip: false };
  }

  return { newSeenFirstFence: seenFirstFence, shouldSkip: false };
}

/**
 * Stream transformation that stops when encountering a markdown code block ending.
 * Handles nested markdown blocks in markdown files.
 */
export async function* stopAtLinesWithMarkdownSupport(
  lines: LineStream,
  filename: string,
): LineStream {
  if (!isMarkdownFile(filename)) {
    for await (const line of lines) {
      if (line.trim() === "```") {
        return;
      }
      yield line;
    }
    return;
  }

  // Collect all lines from the LLM stream first
  const allLines: string[] = [];
  for await (const line of lines) {
    allLines.push(line);
  }

  // The LLM reply starts *inside* the outer fence (the prompt prefills the opening fence).
  // Inner blocks in the markdown body open with a fence line; while one is open, everything
  // except a valid closer is content (per CommonMark, fences do not nest). A fence line
  // needs 3+ backticks and at most 3 spaces of indentation; a closer must use at least as
  // many backticks as its opener and carry no info string.
  // A bare top-level fence is ambiguous (plain inner opener vs. the outer closer): treat it
  // as the outer closer only when no fence lines follow it.
  const FENCE_RE = /^ {0,3}(`{3,})(.*)$/;
  const fenceIndices: number[] = [];
  for (let i = 0; i < allLines.length; i++) {
    if (FENCE_RE.test(allLines[i])) {
      fenceIndices.push(i);
    }
  }
  const lastFenceLine = fenceIndices[fenceIndices.length - 1] ?? -1;

  let innerOpener: number | null = null; // Backtick count of the open inner fence

  for (const i of fenceIndices) {
    const fenceMatch = allLines[i].match(FENCE_RE)!;
    const backtickCount = fenceMatch[1].length;
    const infoString = fenceMatch[2].trim();

    if (innerOpener === null) {
      if (infoString.length === 0 && i === lastFenceLine) {
        // Bare fence at the top level with nothing after it: the outer closing fence.
        // Stop before it so the wrapper never leaks into the applied file.
        for (let j = 0; j < i; j++) {
          yield allLines[j];
        }
        return;
      }
      // Opening fence (with or without an info string) — enter an inner block
      innerOpener = backtickCount;
    } else if (infoString.length === 0 && backtickCount >= innerOpener) {
      // Valid closer for the open inner block
      innerOpener = null;
    }
    // Any other backtick line inside an open inner block is content
  }

  // No outer closing fence found. If the stream ends with an unclosed inner fence
  // (malformed markdown) or its final line is a fence, prefer treating that last fence
  // as the outer closer so the wrapper delimiter never leaks into the edit output.
  if (
    lastFenceLine >= 0 &&
    (innerOpener !== null || lastFenceLine === allLines.length - 1)
  ) {
    for (let j = 0; j < lastFenceLine; j++) {
      yield allLines[j];
    }
    return;
  }

  // Yield everything
  for (const line of allLines) {
    yield line;
  }
}
