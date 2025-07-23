import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

// @ts-ignore no typings available
import { changed, diff as myersDiff } from "myers-diff";
import { streamDiff } from "../diff/streamDiff.js";
import { DiffLine, DiffType } from "../index.js";
import { generateLines } from "./util.js";

// "modification" is an extra type used to represent an "old" + "new" diff line
type MyersDiffTypes = Extract<DiffType, "new" | "old"> | "modification";

const UNIFIED_DIFF_SYMBOLS = {
  same: "",
  new: "+",
  old: "-",
};

async function collectDiffs(
  oldLines: string[],
  newLines: string[],
): Promise<{ streamDiffs: DiffLine[]; myersDiffs: any }> {
  const streamDiffs: DiffLine[] = [];

  for await (const diffLine of streamDiff(oldLines, generateLines(newLines))) {
    streamDiffs.push(diffLine);
  }

  const myersDiffs = myersDiff(oldLines.join("\n"), newLines.join("\n"));

  return { streamDiffs, myersDiffs };
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

async function expectDiff(file: string) {
  const testFilePath = path.join(__dirname, "test-examples", file + ".diff");
  const testFileContents = fs.readFileSync(testFilePath, "utf-8");
  const [oldText, newText, expectedDiff] = testFileContents
    .split("\n---\n")
    .map((s) => s.replace(/^\n+/, "").trimEnd());
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);
  const displayedDiff = displayDiff(streamDiffs);

  if (!expectedDiff || expectedDiff.trim() === "") {
    console.log(
      "Expected diff was empty. Writing computed diff to the test file",
    );
    fs.writeFileSync(
      testFilePath,
      `${oldText}\n\n---\n\n${newText}\n\n---\n\n${displayedDiff}`,
    );

    throw new Error("Expected diff is empty");
  }

  expect(displayedDiff).toEqual(expectedDiff);
}

// We use a longer `)` string here to not get
// caught by the fuzzy matcher
describe("streamDiff(", () => {
  test("no changes", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "same", line: "second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs).toEqual([]);
  });

  test("add new line", async () => {
    const oldLines = ["first item", "second arg"];
    const newLines = ["first item", "second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "same", line: "second arg" },
      { type: "new", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("remove line", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test("modify line", async () => {
    const oldLines = ["first item", "second arg", "third param"];
    const newLines = ["first item", "modified second arg", "third param"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "new", line: "modified second arg" },
      { type: "same", line: "third param" },
    ]);

    expect(myersDiffs.length).toEqual(1);
    expect(getMyersDiffType(myersDiffs[0])).toBe("modification");
  });

  test("add multiple lines", async () => {
    const oldLines = ["first item", "fourth val"];
    const newLines = ["first item", "second arg", "third param", "fourth val"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "new", line: "second arg" },
      { type: "new", line: "third param" },
      { type: "same", line: "fourth val" },
    ]);

    // Multi-line addition
    expect(myersDiffs[0].rhs.add).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("remove multiple lines", async () => {
    const oldLines = ["first item", "second arg", "third param", "fourth val"];
    const newLines = ["first item", "fourth val"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item" },
      { type: "old", line: "second arg" },
      { type: "old", line: "third param" },
      { type: "same", line: "fourth val" },
    ]);

    // Multi-line deletion
    expect(myersDiffs[0].lhs.del).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test("empty old lines", async () => {
    const oldLines: string[] = [];
    const newLines = ["first item", "second arg"];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "new", line: "first item" },
      { type: "new", line: "second arg" },
    ]);

    // Multi-line addition
    expect(myersDiffs[0].rhs.add).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("new");
  });

  test("empty new lines", async () => {
    const oldLines = ["first item", "second arg"];
    const newLines: string[] = [];

    const { streamDiffs, myersDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "old", line: "first item" },
      { type: "old", line: "second arg" },
    ]);

    // Multi-line deletion
    expect(myersDiffs[0].lhs.del).toEqual(2);
    expect(getMyersDiffType(myersDiffs[0])).toBe("old");
  });

  test("tabs vs. spaces differences are ignored", async () => {
    await expectDiff("fastapi-tabs-vs-spaces.py");
  });

  test("trailing whitespaces should match ", async () => {
    const oldLines = ["first item  ", "second arg ", "third param  "];

    const newLines = ["first item", "second arg", "third param "];

    const { streamDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "first item  " },
      { type: "same", line: "second arg " },
      { type: "same", line: "third param  " },
    ]);
  });

  //indentation and whitespace handling
  test.each([false, true])(
    "ignores indentation changes for sufficiently long lines (trailingWhitespace: %s)",
    async (trailingWhitespace) => {
      let oldLines = [
        " short",
        "   middle",
        " a long enough line",
        "  short2",
        "indented line",
        "final line",
      ];

      let newLines = [
        "short",
        "middle",
        "a long enough line",
        "short2",
        " indented line",
        "final line",
      ];

      if (trailingWhitespace) {
        oldLines = oldLines.map((line) => line + " ");
      }

      const { streamDiffs } = await collectDiffs(oldLines, newLines);
      const expected = trailingWhitespace
        ? [
            { type: "old", line: " short " },
            { type: "new", line: "short" },
            { type: "old", line: "   middle " },
            { type: "new", line: "middle" },
            { type: "same", line: " a long enough line " },
            { type: "same", line: "  short2 " },
            { type: "same", line: "indented line " },
            { type: "same", line: "final line " },
          ]
        : [
            { type: "old", line: " short" },
            { type: "new", line: "short" },
            { type: "old", line: "   middle" },
            { type: "new", line: "middle" },
            { type: "same", line: " a long enough line" },
            { type: "same", line: "  short2" },
            { type: "same", line: "indented line" },
            { type: "same", line: "final line" },
          ];

      expect(streamDiffs).toEqual(expected);
    },
  );

  test("preserves original lines for minor reindentation in simple block", async () => {
    const oldLines = ["if (checkValueOf(x)) {", "   doSomethingWith(x);", "}"];
    const newLines = ["if (checkValueOf(x)) {", "  doSomethingWith(x);", "}"];

    const { streamDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "if (checkValueOf(x)) {" },
      { type: "same", line: "   doSomethingWith(x);" },
      { type: "same", line: "}" },
    ]);
  });

  test("uses new lines for nested reindentation changes", async () => {
    const oldLines = ["if (checkValueOf(x)) {", "   doSomethingWith(x);", "}"];
    const newLines = [
      "if (checkValueOf(x)) {",
      "   if (reallyCheckValueOf(x)) {",
      "     doSomethingElseWith(x);",
      "   }",
      "}",
    ];

    const { streamDiffs } = await collectDiffs(oldLines, newLines);

    expect(streamDiffs).toEqual([
      { type: "same", line: "if (checkValueOf(x)) {" },
      { type: "new", line: "   if (reallyCheckValueOf(x)) {" },
      { type: "old", line: "   doSomethingWith(x);" },
      { type: "new", line: "     doSomethingElseWith(x);" },
      { type: "old", line: "}" },
      { type: "new", line: "   }" },
      { type: "new", line: "}" },
    ]);
  });

  test("FastAPI example", async () => {
    await expectDiff("fastapi.py");
  });

  test("FastAPI comments", async () => {
    await expectDiff("add-comments.py");
  });

  test("Mock LLM example", async () => {
    await expectDiff("mock-llm.ts");
  });
});
