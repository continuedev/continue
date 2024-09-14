import fs from "node:fs";

// @ts-ignore no typings available
import { changed, diff as myersDiff } from "myers-diff";
import path from "node:path";
import { DiffLine, DiffLineType } from "../..";
import { dedent } from "../../util";
import { deterministicApplyLazyEdit2 as deterministicApplyLazyEdit } from "./deterministic2";

// "modification" is an extra type used to represent an "old" + "new" diff line
type MyersDiffTypes = Extract<DiffLineType, "new" | "old"> | "modification";

const UNIFIED_DIFF_SYMBOLS = {
  same: "",
  new: "+",
  old: "-",
};

async function collectDiffs(
  oldFile: string,
  newFile: string,
  filename: string,
): Promise<{ ourDiffs: DiffLine[]; myersDiffs: any }> {
  const ourDiffs: DiffLine[] = [];

  for (const diffLine of (await deterministicApplyLazyEdit(
    oldFile,
    newFile,
    filename,
  )) ?? []) {
    ourDiffs.push(diffLine);
  }

  const myersDiffs = myersDiff(oldFile, newFile);

  return { ourDiffs, myersDiffs };
}

function getMyersDiffType(diff: any): MyersDiffTypes | undefined {
  if (changed(diff.rhs) && !changed(diff.lhs)) {
    return "new";
  }

  if (!changed(diff.rhs) && changed(diff.lhs)) {
    return "old";
  }

  if (changed(diff.rhs) && changed(diff.lhs)) {
    return "modification";
  }

  return undefined;
}

function displayDiff(diff: DiffLine[]) {
  return diff
    .map(({ type, line }) => `${UNIFIED_DIFF_SYMBOLS[type]} ${line}`)
    .join("\n");
}

function normalizeDisplayedDiff(d: string): string {
  return d
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : line))
    .join("\n");
}

async function expectDiff(file: string) {
  const testFilePath = path.join(
    __dirname,
    "edit",
    "lazy",
    "test-examples",
    file + ".diff",
  );
  const testFileContents = fs.readFileSync(testFilePath, "utf-8");
  const [oldFile, newFile, expectedDiff] = testFileContents
    .split("\n---\n")
    .map((s) => s.replace(/^\n+/, "").trimEnd());
  const { ourDiffs: streamDiffs, myersDiffs } = await collectDiffs(
    oldFile,
    newFile,
    file,
  );
  const displayedDiff = displayDiff(streamDiffs);

  if (!expectedDiff || expectedDiff.trim() === "") {
    console.log(
      "Expected diff was empty. Writing computed diff to the test file",
    );
    fs.writeFileSync(
      testFilePath,
      `${oldFile}\n\n---\n\n${newFile}\n\n---\n\n${displayedDiff}`,
    );

    throw new Error("Expected diff is empty");
  }

  expect(normalizeDisplayedDiff(displayedDiff)).toEqual(
    normalizeDisplayedDiff(expectedDiff),
  );
}

describe("deterministicApplyLazyEdit(", () => {
  test("no changes", async () => {
    const file = dedent`
        function test() {
            return 1;
        }

        function test2(a) {
            return a * 2;
        }
    `;

    const { ourDiffs: streamDiffs, myersDiffs } = await collectDiffs(
      file,
      file,
      "test.js",
    );

    expect(streamDiffs).toEqual(
      file.split("\n").map((line) => ({
        line,
        type: "same",
      })),
    );

    expect(myersDiffs).toEqual([]);
  });

  test("fastapi", async () => {
    await expectDiff("fastapi.py");
  });

  test("calculator exp", async () => {
    await expectDiff("calculator-exp.js");
  });

  test.only("calculator comments", async () => {
    await expectDiff("calculator-comments.js");
  });
});
