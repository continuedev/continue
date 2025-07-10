import { DiffLine } from "../..";

/**
 * Given a diff of two editable regions, get the offset position at the last new line inside the editable region.
 * @param diffLines Result of myersDiff.
 * @param lineContentAtCursorPos Content of the line at cursor position.
 * @param lineOffsetAtCursorPos Offset of the line at cursor position compared to the start of the editable region.
 * @returns Offset position at last new line inside the editable region.
 */
export function getOffsetPositionAtLastNewLine(
  diffLines: DiffLine[],
  lineContentAtCursorPos: string,
  lineOffsetAtCursorPos: number,
): {
  line: number;
  character: number;
} {
  let lastNewLineContent = "";
  let lineOffset = -1;
  let currentResultLine = 0;
  let hasChanges = false;

  // Build the string while tracking line numbers in the result
  diffLines.reduce((acc, curr, i) => {
    // Add the current line to our result
    acc += curr.line;

    // Add newline if not the last line
    if (i < diffLines.length - 1) {
      acc += "\n";
    }

    // If this is a "new" or "same" line, it will be part of the result
    if (curr.type === "new" || curr.type === "same") {
      if (curr.type === "new") {
        // If it's a new line, update our tracking
        lastNewLineContent = curr.line;
        lineOffset = currentResultLine;
        hasChanges = true;
      }
      // Increment our position in the result
      currentResultLine++;
    }

    return acc;
  }, "");

  // If nothing has changed, return the original position
  if (!hasChanges) {
    lineOffset = lineOffsetAtCursorPos;
    lastNewLineContent = lineContentAtCursorPos;
  }
  // Calculate the character position for the end of the last relevant line
  const endOfCharPos = lastNewLineContent.length;
  return {
    line: lineOffset,
    character: endOfCharPos,
  };
}

export function getRenderableDiffWithGutterAnnotations(
  diffLines: DiffLine[],
  lineContentAtCursorPos: string,
  lineOffsetAtCursorPos: number,
): {
  offset: {
    line: number;
    character: number;
  };
} {
  let lastNewLineContent = "";
  let lineOffset = -1;
  let currentResultLine = 0;
  let hasChanges = false;

  // Build the string while tracking line numbers in the result
  diffLines.reduce((acc, curr, i) => {
    // Add the current line to our result
    acc += curr.line;

    // Add newline if not the last line
    if (i < diffLines.length - 1) {
      acc += "\n";
    }

    // If this is a "new" or "same" line, it will be part of the result
    if (curr.type === "new" || curr.type === "same") {
      if (curr.type === "new") {
        // If it's a new line, update our tracking
        lastNewLineContent = curr.line;
        lineOffset = currentResultLine;
        hasChanges = true;
      }
      // Increment our position in the result
      currentResultLine++;
    }

    return acc;
  }, "");

  // If nothing has changed, return the original position
  if (!hasChanges) {
    lineOffset = lineOffsetAtCursorPos;
    lastNewLineContent = lineContentAtCursorPos;
  }
  // Calculate the character position for the end of the last relevant line
  const endOfCharPos = lastNewLineContent.length;
  return {
    offset: {
      line: lineOffset,
      character: endOfCharPos,
    },
  };
}

/**
 * Check if the diff is indeed a FIM.
 * @param oldEditRange Original string content.
 * @param newEditRange New string content.
 * @param cursorPosition The position of the cursor in the old string.
 * @returns boolean indicating if the change is purely additive (FIM)
 * @returns string of FIM text content.
 */
export function checkFim(
  oldEditRange: string,
  newEditRange: string,
  cursorPosition: { line: number; character: number },
):
  | {
      isFim: true;
      fimText: string;
    }
  | {
      isFim: false;
      fimText: null;
    } {
  // Find the common prefix.
  let prefixLength = 0;
  while (
    prefixLength < oldEditRange.length &&
    prefixLength < newEditRange.length &&
    oldEditRange[prefixLength] === newEditRange[prefixLength]
  ) {
    prefixLength++;
  }

  // Find the common suffix
  let oldSuffixPos = oldEditRange.length - 1;
  let newSuffixPos = newEditRange.length - 1;

  while (
    oldSuffixPos >= prefixLength &&
    newSuffixPos >= prefixLength &&
    oldEditRange[oldSuffixPos] === newEditRange[newSuffixPos]
  ) {
    oldSuffixPos--;
    newSuffixPos--;
  }

  // The old text is purely preserved if:
  // 1. The prefix ends before or at the cursor.
  // 2. The suffix starts after or at the cursor.
  // 3. There's no gap between prefix and suffix in the old text.

  const suffixStartInOld = oldSuffixPos + 1;
  const suffixStartInNew = newSuffixPos + 1;

  // Convert cursor position to an offset in the string.
  // For simplicity, we need to calculate the cursor's position in the string.
  // This requires knowledge of line endings in the oldEditRange.
  const lines = oldEditRange.substring(0, prefixLength).split("\n");
  const cursorOffset =
    lines.length > 1
      ? lines.slice(0, -1).reduce((sum, line) => sum + line.length + 1, 0) +
        cursorPosition.character
      : cursorPosition.character;

  // Check if the cursor is positioned between the prefix and suffix.
  const cursorBetweenPrefixAndSuffix =
    prefixLength <= cursorOffset && cursorOffset <= suffixStartInOld;

  // Check if the old text is completely preserved (no deletion).
  const noTextDeleted = suffixStartInOld - prefixLength <= 0;

  const isFim = cursorBetweenPrefixAndSuffix && noTextDeleted;

  if (isFim) {
    // Extract the content between prefix and suffix in the new string.
    const fimText = newEditRange.substring(prefixLength, suffixStartInNew);
    return { isFim, fimText };
  } else {
    return { isFim, fimText: null };
  }
}
