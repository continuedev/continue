import { diffLines, type Change } from "diff";
import { DiffLine } from "../..";
import { convertMyersChangeToDiffLines } from "../../diff/myers";
import { isLazyLine } from "./deterministic";

function bubbleUpLazyBlocks(originalChanges: Change[]): Change[] {
  const changes = [...originalChanges];
  for (let i = 1; i < changes.length; i++) {
    const change = changes[i];
    if (
      // Single line
      change.count === 1 &&
      // lazy line
      isLazyLine(change.value) &&
      // with a removal above
      changes[i - 1].removed
    ) {
      // Bubble up and merge together the removals into a single remove change
      while (
        i + 1 < changes.length &&
        (changes[i + 1].value.trim() === "" || changes[i + 1].removed)
      ) {
        // Merge the removed/new line with the removal above
        const changeValue = changes[i + 1].value;
        changes[i - 1].value += changeValue;

        // and then delete
        changes.splice(i + 1, 1);
      }
    }
  }
  return changes;
}

export async function deterministicApplyLazyEdit2(
  oldFile: string,
  newLazyFile: string,
  filename: string,
): Promise<DiffLine[] | undefined> {
  // // Strip surrounding new lines away from lazy blocks
  // const lazyFileLines = newLazyFile.split("\n");
  // const processedLazyFileLines = [];
  // for (let i = 0; i < lazyFileLines.length - 1; ++i) {
  //   const line = lazyFileLines[i];
  //   const nextLine = lazyFileLines[i + 1];
  //   if (line.trim() === "" && isLazyLine(nextLine)) {
  //     continue;
  //   } else if (isLazyLine(line) && nextLine.trim() === "") {
  //     i++;
  //     processedLazyFileLines.push(line);
  //     continue;
  //   }
  //   processedLazyFileLines.push(line);
  // }
  // newLazyFile = processedLazyFileLines.join("\n");

  let theirFormat = diffLines(oldFile, newLazyFile, {
    newlineIsToken: false,
  });
  const lines: DiffLine[] = [];
  const removedLinesBuffer: DiffLine[] = [];

  theirFormat = bubbleUpLazyBlocks(theirFormat);

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
      if (!isLazyLine(change.value.split("\n")[0])) {
        lines.push(
          ...convertMyersChangeToDiffLines({
            ...change,
            value: change.value.split("\n").slice(0, -1).join("\n"),
          }),
        );
      }
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
