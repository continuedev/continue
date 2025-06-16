import { DiffLine } from "../..";

export function getRenderableDiff(diffLines: DiffLine[]) {
  let diffLineNumberStart = -1;
  const diff = diffLines.reduce((acc, curr, i) => {
    if (curr.type === "new") {
      acc += `${curr.line}\n`;

      if (diffLineNumberStart === -1) {
        diffLineNumberStart = i;
      }
    }
    return acc;
  }, "");

  return diff;
}
