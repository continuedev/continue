import { diffLines, type Change } from "diff";
import { DiffLine } from "..";

export function convertMyersChangeToDiffLines(change: Change): DiffLine[] {
  const type: DiffLine["type"] = change.added
    ? "new"
    : change.removed
      ? "old"
      : "same";
  const lines = change.value.trimEnd().split("\n");
  return lines.map((line) => ({ type, line }));
}

export function myersDiff(oldContent: string, newContent: string): DiffLine[] {
  const theirFormat = diffLines(oldContent, newContent);
  const ourFormat = theirFormat.flatMap(convertMyersChangeToDiffLines);

  return ourFormat;
}
