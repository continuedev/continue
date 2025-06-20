import { DiffLine } from "../..";

export function getRenderableDiff(diffLines: DiffLine[]) {
  const diff = diffLines.reduce((acc, curr, i) => {
    if (curr.type === "new") {
      acc += `${curr.line}\n`;
      // } else if (curr.type === "old") {
      //   acc += `${curr.line}\n`;
      // } else if (curr.type == "same") {
      //   acc += `${curr.line}\n`;
    }
    return acc;
  }, "");

  return diff;
}

export function getRenderableDiffWithGutterAnnotations(diffLines: DiffLine[]) {
  const diff = diffLines.reduce((acc, curr, i) => {
    if (curr.type === "new") {
      acc += `+ ${curr.line}\n`;
      // } else if (curr.type === "old") {
      //   acc += `- ${curr.line}\n`;
      // } else if (curr.type == "same") {
      //   acc += `  ${curr.line}\n`;
    }
    return acc;
  }, "");

  return diff;
}
