import { diffChars, diffLines, type Change } from "diff";

import { DiffChar, DiffLine } from "..";

export function convertMyersChangeToDiffLines(change: Change): DiffLine[] {
  const type: DiffLine["type"] = change.added
    ? "new"
    : change.removed
      ? "old"
      : "same";
  const lines = change.value.split("\n");

  // Ignore the \n at the end of the final line, if there is one
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.map((line) => ({ type, line }));
}

// The interpretation of lines in oldContent and newContent is the same as jsdiff
// Lines are separated by \n, with the exception that a trailing \n does *not*
// represent an empty line.
//
// The default for jsdiff is that "foo" and "foo\n" are *different* single-line
// contents, but we can't represent that: to avoid a diff
// [ { type: "old", line: "foo" }, { type: "new", line: "foo" } ], we
// pass ignoreNewlineAtEof: true.
export function myersDiff(oldContent: string, newContent: string): DiffLine[] {
  const theirFormat = diffLines(oldContent, newContent, {
    ignoreNewlineAtEof: true,
  });
  let ourFormat = theirFormat.flatMap(convertMyersChangeToDiffLines);

  // Combine consecutive old/new pairs that are identical after trimming
  for (let i = 0; i < ourFormat.length - 1; i++) {
    if (
      ourFormat[i]?.type === "old" &&
      ourFormat[i + 1]?.type === "new" &&
      ourFormat[i].line.trim() === ourFormat[i + 1].line.trim()
    ) {
      ourFormat[i] = { type: "same", line: ourFormat[i].line };
      ourFormat.splice(i + 1, 1);
    }
  }

  // Remove trailing empty old lines
  while (
    ourFormat.length > 0 &&
    ourFormat[ourFormat.length - 1].type === "old" &&
    ourFormat[ourFormat.length - 1].line === ""
  ) {
    ourFormat.pop();
  }

  return ourFormat;
}

export function myersCharDiff(
  oldContent: string,
  newContent: string,
): DiffChar[] {
  // Process the content character by character.
  // We will handle newlines separately,
  // because diffChars does not have an option to ignore eol newlines.
  const theirFormat = diffChars(oldContent, newContent);

  // Track indices as we process the diff.
  let oldIndex = 0;
  let newIndex = 0;
  let oldLineIndex = 0;
  let newLineIndex = 0;
  let oldCharIndexInLine = 0;
  let newCharIndexInLine = 0;

  const result: DiffChar[] = [];

  for (const change of theirFormat) {
    // Split the change value by newlines to handle them separately.
    if (change.value.includes("\n")) {
      const parts = change.value.split(/(\n)/g); // This keeps the newlines as separate entries.

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") continue;

        if (part === "\n") {
          // Handle newline.
          if (change.added) {
            result.push({
              type: "new",
              char: part,
              newIndex: newIndex,
              newLineIndex: newLineIndex,
              newCharIndexInLine: newCharIndexInLine,
            });
            newIndex += part.length;
            newLineIndex++;
            newCharIndexInLine = 0; // Reset when moving to a new line.
          } else if (change.removed) {
            result.push({
              type: "old",
              char: part,
              oldIndex: oldIndex,
              oldLineIndex: oldLineIndex,
              oldCharIndexInLine: oldCharIndexInLine,
            });
            oldIndex += part.length;
            oldLineIndex++;
            oldCharIndexInLine = 0; // Reset when moving to a new line.
          } else {
            result.push({
              type: "same",
              char: part,
              oldIndex: oldIndex,
              newIndex: newIndex,
              oldLineIndex: oldLineIndex,
              newLineIndex: newLineIndex,
              oldCharIndexInLine: oldCharIndexInLine,
              newCharIndexInLine: newCharIndexInLine,
            });
            oldIndex += part.length;
            newIndex += part.length;
            oldLineIndex++;
            newLineIndex++;
            oldCharIndexInLine = 0;
            newCharIndexInLine = 0;
          }
        } else {
          // Handle regular text.
          if (change.added) {
            result.push({
              type: "new",
              char: part,
              newIndex: newIndex,
              newLineIndex: newLineIndex,
              newCharIndexInLine: newCharIndexInLine,
            });
            newIndex += part.length;
            newCharIndexInLine += part.length;
          } else if (change.removed) {
            result.push({
              type: "old",
              char: part,
              oldIndex: oldIndex,
              oldLineIndex: oldLineIndex,
              oldCharIndexInLine: oldCharIndexInLine,
            });
            oldIndex += part.length;
            oldCharIndexInLine += part.length;
          } else {
            result.push({
              type: "same",
              char: part,
              oldIndex: oldIndex,
              newIndex: newIndex,
              oldLineIndex: oldLineIndex,
              newLineIndex: newLineIndex,
              oldCharIndexInLine: oldCharIndexInLine,
              newCharIndexInLine: newCharIndexInLine,
            });
            oldIndex += part.length;
            newIndex += part.length;
            oldCharIndexInLine += part.length;
            newCharIndexInLine += part.length;
          }
        }
      }
    } else {
      // No newlines, handle as a simple change.
      if (change.added) {
        result.push({
          type: "new",
          char: change.value,
          newIndex: newIndex,
          newLineIndex: newLineIndex,
          newCharIndexInLine: newCharIndexInLine,
        });
        newIndex += change.value.length;
        newCharIndexInLine += change.value.length;
      } else if (change.removed) {
        result.push({
          type: "old",
          char: change.value,
          oldIndex: oldIndex,
          oldLineIndex: oldLineIndex,
          oldCharIndexInLine: oldCharIndexInLine,
        });
        oldIndex += change.value.length;
        oldCharIndexInLine += change.value.length;
      } else {
        result.push({
          type: "same",
          char: change.value,
          oldIndex: oldIndex,
          newIndex: newIndex,
          oldLineIndex: oldLineIndex,
          newLineIndex: newLineIndex,
          oldCharIndexInLine: oldCharIndexInLine,
          newCharIndexInLine: newCharIndexInLine,
        });
        oldIndex += change.value.length;
        newIndex += change.value.length;
        oldCharIndexInLine += change.value.length;
        newCharIndexInLine += change.value.length;
      }
    }
  }

  return result;
}
