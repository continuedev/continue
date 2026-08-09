import { DiffLine } from "core";

export function getFirstChangedLine(
  diff: DiffLine[],
  startLine: number,
): number | null {
  for (let i = 0; i < diff.length; i++) {
    const item = diff[i];
    if (item.type === "old" || item.type === "new") {
      return startLine + i;
    }
  }
  return null;
}
