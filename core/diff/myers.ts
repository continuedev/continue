import { diffLines, type Change } from "diff";

import { DiffLine } from "..";

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
  // BUT be more conservative about structural changes
  for (let i = 0; i < ourFormat.length - 1; i++) {
    if (
      ourFormat[i]?.type === "old" &&
      ourFormat[i + 1]?.type === "new" &&
      ourFormat[i].line.trim() === ourFormat[i + 1].line.trim()
    ) {
      // Don't merge if there are significant indentation or structural differences
      const hasStructuralChange = ourFormat[i].line !== ourFormat[i + 1].line;

      // Be especially careful with test-related lines and large diffs
      const isTestRelated =
        ourFormat[i].line.includes("describe(") ||
        ourFormat[i].line.includes("test(") ||
        ourFormat[i].line.includes("expect(") ||
        ourFormat[i].line.includes("beforeEach(") ||
        ourFormat[i].line.includes("afterEach(");

      // If we're in the middle of a large diff (many changes), be more conservative
      const countChangesAround = (startIdx: number, radius: number) => {
        let changes = 0;
        for (
          let j = Math.max(0, startIdx - radius);
          j < Math.min(ourFormat.length, startIdx + radius);
          j++
        ) {
          if (ourFormat[j].type !== "same") changes++;
        }
        return changes;
      };

      const manyChangesNearby = countChangesAround(i, 20) > 10; // Many changes in 40-line window

      if (!hasStructuralChange || (!isTestRelated && !manyChangesNearby)) {
        ourFormat[i] = { type: "same", line: ourFormat[i].line };
        ourFormat.splice(i + 1, 1);
      }
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
