import { DiffLine } from "../..";

export function getRenderableDiff(diffLines: DiffLine[]): {
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
      acc += `${curr.line}\n`;
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
