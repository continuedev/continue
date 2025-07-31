import { ApplyState } from "core";

/**
 * Compute precise diff information between original and new content
 * Returns the exact lines that changed and their positions
 */
export function computeChangedLines(
  originalContent: string,
  newContent: string,
): ApplyState["changedLines"] {
  
  // Handle empty content cases
  if (!originalContent && !newContent) {
    return undefined;
  }
  
  if (!originalContent) {
    // New file - all lines are new
    const newLines = newContent.split('\n');
    return {
      previousLines: [],
      newLines,
      startLine: 0,
      endLine: newLines.length - 1,
    };
  }
  
  if (!newContent) {
    // File deleted - all lines were removed
    const originalLines = originalContent.split('\n');
    return {
      previousLines: originalLines,
      newLines: [],
      startLine: 0,
      endLine: originalLines.length - 1,
    };
  }

  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // Find the range of changed lines using a simple approach
  let firstChangedLine = 0;
  let lastChangedLineOriginal = originalLines.length - 1;
  let lastChangedLineNew = newLines.length - 1;

  // Find first differing line from the start
  while (
    firstChangedLine < originalLines.length &&
    firstChangedLine < newLines.length &&
    originalLines[firstChangedLine] === newLines[firstChangedLine]
  ) {
    firstChangedLine++;
  }

  // Find last differing line from the end
  while (
    lastChangedLineOriginal >= firstChangedLine &&
    lastChangedLineNew >= firstChangedLine &&
    originalLines[lastChangedLineOriginal] === newLines[lastChangedLineNew]
  ) {
    lastChangedLineOriginal--;
    lastChangedLineNew--;
  }

  // If no differences found, content is identical
  if (firstChangedLine > lastChangedLineOriginal && firstChangedLine > lastChangedLineNew) {
    return undefined;
  }

  // Extract the changed sections
  const previousLines = originalLines.slice(firstChangedLine, lastChangedLineOriginal + 1);
  const changedNewLines = newLines.slice(firstChangedLine, lastChangedLineNew + 1);

  const result = {
    previousLines,
    newLines: changedNewLines,
    startLine: firstChangedLine,
    endLine: Math.max(lastChangedLineOriginal, lastChangedLineNew),
  };

  console.log("DIFF_DEBUG:", JSON.stringify({
    originalContentLength: originalContent.length,
    newContentLength: newContent.length,
    originalLinesCount: originalLines.length,
    newLinesCount: newLines.length,
    firstChangedLine,
    lastChangedLineOriginal,
    lastChangedLineNew,
    previousLinesCount: previousLines.length,
    changedNewLinesCount: changedNewLines.length,
    previousLinesPreview: previousLines.slice(0, 3),
    newLinesPreview: changedNewLines.slice(0, 3),
    result
  }, null, 2));

  return result;
}