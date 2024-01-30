import { streamDiff } from "../diff/streamDiff";

const oldCode = [
  `A
B`,
  `A
B
C`,
  `A
B
C
A
B
B
A`,
  `function mergeSortAlgorithm() {
    // TODO: implement
}`,
  `function mergeSortAlgorithm() {
    // TODO: implement
}`,
];

const newCode = [
  `C
D`,
  `D
E
C
F
C`,
  `C
B
A
B
A
C`,
  `function mergeSortAlgorithm(arr: number[]): number[] {
  if (arr.length <= 1) {
    return arr;
  }

  const middle = Math.floor(arr.length / 2);
  const left = arr.slice(0, middle);
  const right = arr.slice(middle);

  return merge(mergeSortAlgorithm(left), mergeSortAlgorithm(right));
}

function merge(left: number[], right: number[]): number[] {
  let resultArray = [], leftIndex = 0, rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] < right[rightIndex]) {
      resultArray.push(left[leftIndex]);
      leftIndex++;
    } else {
      resultArray.push(right[rightIndex]);
      rightIndex++;
    }
  }

  return resultArray
    .concat(left.slice(leftIndex))
    .concat(right.slice(rightIndex));
}`,
  `function mergeSortAlgorithm(array) {
  if (array.length <= 1) {
    return array;
  }

  const mid = Math.floor(array.length / 2);
  const left = array.slice(0, mid);
  const right = array.slice(mid);

  return merge(mergeSortAlgorithm(left), mergeSortAlgorithm(right));
}

function merge(left, right) {
  let resultArray = [], leftIndex = 0, rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] < right[rightIndex]) {
      resultArray.push(left[leftIndex]);
      leftIndex++;
    } else {
      resultArray.push(right[rightIndex]);
      rightIndex++;
    }
  }

  return resultArray
          .concat(left.slice(leftIndex))
          .concat(right.slice(rightIndex));
}
`,
];

async function* generateLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

describe("streamDiff", () => {
  for (let i = 0; i < oldCode.length; i++) {
    test(`outputs valid diff #${i}`, async () => {
      const oldLines = oldCode[i].split("\n");
      const newLines = newCode[i].split("\n");

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

      // Check that every line is represented
      expect(oldLines.length).toEqual(numOld + numSame);
      expect(newLines.length).toEqual(numNew + numSame);

      // Check that there are no red lines immediately following green (they should always be above)
      for (let i = 1; i < diff.length; i++) {
        if (diff[i].type === "old" && diff[i - 1].type === "new") {
          throw new Error(
            `Found red '${diff[i].line}' immediately after green line '${
              diff[i - 1].line
            }`
          );
        }
      }
    });
  }
});
