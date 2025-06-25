import { DiffLine } from "../..";

export function getRenderableDiff(
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

export function getRenderableDiffWithGutterAnnotations(diffLines: DiffLine[]): {
  renderableDiff: string;
  offset: {
    line: number;
    character: number;
  };
} {
  let lastNewLineIndex = -1;
  let lastNewLine = "";

  // Build the string with only "new" lines.
  let diff = diffLines.reduce((acc, curr, i) => {
    if (curr.type === "new") {
      lastNewLineIndex = i;
      lastNewLine = curr.line;
      acc += `+ ${curr.line}\n`;
    }
    return acc;
  }, "");

  // Remove the last newline character if it exists.
  if (diff.length > 0 && diff.charAt(diff.length - 1) === "\n") {
    diff = diff.slice(0, -1);
  }

  // There seems to always be an old line replaced by a series of new lines.
  // Account for this by subtracting one.
  lastNewLineIndex -= 1;

  // Calculate the character position for the end of the last "new" line.
  const endOfCharPos = lastNewLineIndex !== -1 ? lastNewLine.length : 0;

  return {
    renderableDiff: diff,
    offset: { line: lastNewLineIndex, character: endOfCharPos },
  };
}
