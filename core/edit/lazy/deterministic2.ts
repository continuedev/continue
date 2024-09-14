import { diffLines } from "diff";
import { DiffLine } from "../..";
import { convertMyersChangeToDiffLines } from "../../diff/myers";
import { isLazyLine } from "./deterministic";

export async function deterministicApplyLazyEdit2(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): Promise<DiffLine[] | undefined> {
  const theirFormat = diffLines(oldFile, newLazyFile);
  const lines: DiffLine[] = [];

  const removedLinesBuffer: DiffLine[] = [];

  for (const change of theirFormat) {
    if (!change.added && !change.removed) {
      lines.push(...removedLinesBuffer);
      removedLinesBuffer.length = 0;
      lines.push(...convertMyersChangeToDiffLines(change));
    } else if (change.added && isLazyLine(change.value.trim())) {
      lines.push(
        ...removedLinesBuffer.map((diffLine) => ({
          ...diffLine,
          type: "same" as const,
        })),
      );
      removedLinesBuffer.length = 0;
    } else if (change.added) {
      lines.push(...removedLinesBuffer);
      removedLinesBuffer.length = 0;
      lines.push(...convertMyersChangeToDiffLines(change));
    } else if (change.removed) {
      removedLinesBuffer.push(...convertMyersChangeToDiffLines(change));
    }
  }

  lines.push(...removedLinesBuffer);
  return lines;
}
