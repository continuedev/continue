import fs from "node:fs";
import path from "node:path";

// @ts-ignore no typings available
import { diff as myersDiff } from "myers-diff";
import { DiffLine } from "../..";
import { myersDiff as continueMyersDiff } from "../../diff/myers";
import { dedent } from "../../util";
import { deterministicApplyLazyEdit } from "./deterministic";

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

function displayDiff(diff: DiffLine[]) {
  return diff
    .map(({ type, line }) =>
      type === "same" ? line : `${UNIFIED_DIFF_SYMBOLS[type]} ${line}`,
    )
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
  const { ourDiffs: streamDiffs } = await collectDiffs(oldFile, newFile, file);
  const displayedDiff = displayDiff(streamDiffs);

  if (!expectedDiff || expectedDiff.trim() === "") {
    console.log(
      "Expected diff was empty. Writing computed diff to the test file",
    );
    fs.writeFileSync(
      testFilePath,
      `${oldFile}\n\n---\n\n${newFile}\n\n---\n\n${displayDiff(
        continueMyersDiff(oldFile, newFile),
      )}`,
    );

    throw new Error("Expected diff is empty");
  }

  expect(normalizeDisplayedDiff(displayedDiff)).toEqual(
    normalizeDisplayedDiff(expectedDiff),
  );
}

// Skipped while we have `ONLY_FULL_FILE_REWRITE` enabled
describe.skip("deterministicApplyLazyEdit(", () => {
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

  test("calculator exp2", async () => {
    await expectDiff("calculator-exp2.js");
  });

  test("calculator comments", async () => {
    await expectDiff("calculator-comments.js");
  });

  test.skip("calculator docstrings", async () => {
    await expectDiff("calculator-docstrings.js");
  });

  test.skip("calculator stateless", async () => {
    await expectDiff("calculator-stateless.js");
  });

  test("top level same blocks", async () => {
    await expectDiff("top-level-same.js");
  });

  test.skip("gui add toggle", async () => {
    await expectDiff("gui.js");
  });

  test("rust calculator", async () => {
    await expectDiff("rust-calc-exp.rs");
  });

  test("no lazy blocks", async () => {
    await expectDiff("no-lazy.js");
  });

  test.skip("no lazy blocks in single top level class", async () => {
    await expectDiff("no-lazy-single-class.js");
  });

  test("should acknowledge jsx_expression lazy comments", async () => {
    await expectDiff("migration-page.tsx");
  });

  test.skip("should handle case where surrounding class is neglected, with lazy block surrounding", async () => {
    await expectDiff("calculator-class-neglected.js");
  });

  test("should handle case where surrounding class is neglected, without lazy block surrounding", async () => {
    await expectDiff("calculator-only-method.js");
  });
});
