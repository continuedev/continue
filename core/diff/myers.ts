import { diffLines } from "diff";
import { DiffLine } from "..";

const headerLineRegex = /^\s*@@ -(\d+),\d+ \+(\d+),\d+ @@/i;
const noNewLineRegex = /\\ No newline at end of file/;
export function myersDiff(oldContent: string, newContent: string): DiffLine[] {
  const theirFormat = diffLines(oldContent, newContent);
  const ourFormat = theirFormat.flatMap((change) => {
    const type: DiffLine["type"] = change.added
      ? "new"
      : change.removed
        ? "old"
        : "same";
    const lines = change.value.split("\n");
    return lines.map((line) => ({ type, line }));
  });

  return ourFormat;
}
