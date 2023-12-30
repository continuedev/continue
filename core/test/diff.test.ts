import { streamDiff } from "../diff/diffLines";

const oldLines = [
  "function mergeSortAlgorithm() {",
  "    // TODO: implement",
  "}",
];

const newLines = [
  "function mergeSortAlgorithm(arr: number[]): number[] {",
  "  if (arr.length <= 1) {",
  "    return arr;",
  "  }",
  "",
  "  const middle = Math.floor(arr.length / 2);",
  "  const left = arr.slice(0, middle);",
  "  const right = arr.slice(middle);",
  "",
  "  return merge(mergeSortAlgorithm(left), mergeSortAlgorithm(right));",
  "}",
  "",
  "function merge(left: number[], right: number[]): number[] {",
  "  let resultArray = [], leftIndex = 0, rightIndex = 0;",
  "",
  "  while (leftIndex < left.length && rightIndex < right.length) {",
  "    if (left[leftIndex] < right[rightIndex]) {",
  "      resultArray.push(left[leftIndex]);",
  "      leftIndex++;",
  "    } else {",
  "      resultArray.push(right[rightIndex]);",
  "      rightIndex++;",
  "    }",
  "  }",
  "",
  "  return resultArray",
  "    .concat(left.slice(leftIndex))",
  "    .concat(right.slice(rightIndex));",
  "}",
];

async function* generateLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

describe("streamDiff", () => {
  test("outputs valid diff", async () => {
    const diff = [];
    for await (const diffLine of streamDiff(
      oldLines,
      generateLines(newLines)
    )) {
      diff.push(diffLine);
    }

    console.log(
      diff
        .map((dl) => {
          return (
            (dl.type === "old" ? "- " : dl.type === "new" ? "+ " : "  ") +
            dl.line
          );
        })
        .join("\n")
    );

    const numSame = diff.filter((dl) => dl.type === "same").length;
    const numOld = diff.filter((dl) => dl.type === "old").length;
    const numNew = diff.filter((dl) => dl.type === "new").length;

    expect(oldLines.length).toEqual(numOld + numSame);
    expect(newLines.length).toEqual(numNew + numSame);
  });
});
