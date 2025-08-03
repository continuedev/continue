import { Position } from "shiki";
import { DiffLine } from "../..";
import { myersDiff } from "../../diff/myers";

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
  // console.log("oldEditRange", oldEditRange);
  // console.log("newEditRange", newEditRange);
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
  // const lines = oldEditRange.substring(0, prefixLength).split("\n");
  // const lines = oldEditRange.split("\n");
  // const cursorOffset =
  //   lines.length > 1
  //     ? lines.slice(0, -1).reduce((sum, line) => sum + line.length + 1, 0) +
  //       cursorPosition.character
  //     : cursorPosition.character;
  const oldEditLines = oldEditRange.split("\n");
  const cursorOffset =
    oldEditLines
      .slice(0, cursorPosition.line)
      .reduce((sum, line) => sum + line.length + 1, 0) +
    cursorPosition.character;

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

export function calculateFinalCursorPosition(
  currCursorPos: Position,
  editableRegionStartLine: number,
  oldEditRangeSlice: string,
  newEditRangeSlice: string,
) {
  // How far away is the current line from the start of the editable region?
  const lineOffsetAtCursorPos = currCursorPos.line - editableRegionStartLine;

  // How long is the line at the current cursor position?
  const lineContentAtCursorPos =
    newEditRangeSlice.split("\n")[lineOffsetAtCursorPos];

  const diffLines = myersDiff(oldEditRangeSlice, newEditRangeSlice);

  const offset = getOffsetPositionAtLastNewLine(
    diffLines,
    lineContentAtCursorPos,
    lineOffsetAtCursorPos,
  );

  // Calculate the actual line number in the editor by adding the startPos offset
  // to the line number from the diff calculation.
  const finalCursorPos: Position = {
    line: editableRegionStartLine + offset.line,
    character: offset.character,
  };

  return finalCursorPos;
}

/**
 * Applies a completion to file content by replacing lines starting from a specific line number
 *
 * @param fileContent The original file content
 * @param completion The completion text to apply
 * @param startLineNumber The line number (0-based) where replacement should start
 * @param linesToReplace Optional number of lines to replace; if not provided, will replace the same number of lines as in the completion
 * @returns The file content with the completion applied
 */
export function applyCompletionToFile(
  fileContent: string,
  completion: string,
  startLineNumber: number,
  linesToReplace?: number,
): string {
  const lines = fileContent.split("\n");
  const completionLines = completion.split("\n");

  // Determine how many lines to replace
  const numLinesToReplace =
    linesToReplace !== undefined ? linesToReplace : completionLines.length;

  // Replace the lines
  const newLines = [
    ...lines.slice(0, startLineNumber),
    ...completionLines,
    ...lines.slice(startLineNumber + numLinesToReplace),
  ];

  return newLines.join("\n");
}

export interface DiffGroup {
  startLine: number;
  endLine: number;
  lines: DiffLine[];
  type?: string; // Optional classification of the group
}

export function groupDiffLines(
  diffLines: DiffLine[],
  maxGap: number = 3,
): DiffGroup[] {
  const groups: DiffGroup[] = [];
  let currentGroup: DiffGroup | null = null;
  let lineNumber = 0;

  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];

    // If it's a changed line and we don't have a current group, start one
    if (line.type !== "same" && !currentGroup) {
      currentGroup = {
        startLine: lineNumber,
        endLine: lineNumber,
        lines: [line],
      };
    }
    // If it's a changed line and we have a current group, add to it
    else if (line.type !== "same" && currentGroup) {
      currentGroup.lines.push(line);
      currentGroup.endLine = lineNumber;
    }
    // If it's an unchanged line and we have a current group
    else if (line.type === "same" && currentGroup) {
      // Check if we've seen too many unchanged lines in a row
      const unchangedCount = currentGroup.lines.filter(
        (l) => l.type === "same",
      ).length;

      if (unchangedCount >= maxGap) {
        // Finalize this group and start a new one
        groups.push(currentGroup);
        currentGroup = null;
      } else {
        // Add this unchanged line to the current group
        currentGroup.lines.push(line);
      }
    }

    lineNumber++;
  }

  // Don't forget the last group if there is one
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
