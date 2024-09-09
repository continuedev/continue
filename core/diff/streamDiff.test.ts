import fs from "node:fs";
import { streamDiff } from "../diff/streamDiff.js";
import { DiffLine, DiffLineType } from "../index.js";
// @ts-ignore no typings available
import { changed, diff as myersDiff } from "myers-diff";
import path from "node:path";

// "modification" is an extra type used to represent an "old" + "new" diff line
type MyersDiffTypes = Extract<DiffLineType, "new" | "old"> | "modification";

const UNIFIED_DIFF_SYMBOLS = {
  same: "",
  new: "+",
  old: "-",
};

async function* generateLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

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
  const testFilePath = path.join(
    __dirname,
    "diff",
    "test-examples",
    file + ".diff",
  );
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
    await expectDiff("fastapi-tabs-vs-spaces");
  });

  test("FastAPI example", async () => {
    await expectDiff("fastapi");
  });

  test("FastAPI comments", async () => {
    await expectDiff("add-comments");
  });

  test("Mock LLM example", async () => {
    await expectDiff("mock-llm");
  });
});
