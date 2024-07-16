import { streamDiff } from "../diff/streamDiff.js";
import { DiffLine } from "../index.js";

async function* generateLines(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    yield line;
  }
}

const collectDiff = async (
  oldLines: string[],
  newLines: string[],
): Promise<DiffLine[]> => {
  const result: DiffLine[] = [];

  for await (const diffLine of streamDiff(oldLines, generateLines(newLines))) {
    result.push(diffLine);
  }

  return result;
};

// We use a longer `console.log()` string here to not get
// caught by the fuzzy matcher
describe("streamDiff()", () => {
  test("no changes", async () => {
    const oldLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
    ];
    const newLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
    ];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "same", line: "console.log(second)" },
      { type: "same", line: "console.log(third)" },
    ]);
  });

  test("add new line", async () => {
    const oldLines = ["console.log(first)", "console.log(second)"];
    const newLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
    ];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "same", line: "console.log(second)" },
      { type: "new", line: "console.log(third)" },
    ]);
  });

  test("remove line", async () => {
    const oldLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
    ];
    const newLines = ["console.log(first)", "console.log(third)"];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "old", line: "console.log(second)" },
      { type: "same", line: "console.log(third)" },
    ]);
  });

  test("modify line", async () => {
    const oldLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
    ];
    const newLines = [
      "console.log(first)",
      "console.log(modified second)",
      "console.log(third)",
    ];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "old", line: "console.log(second)" },
      { type: "new", line: "console.log(modified second)" },
      { type: "same", line: "console.log(third)" },
    ]);
  });

  test("add multiple lines", async () => {
    const oldLines = ["console.log(first)", "fourth"];
    const newLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
      "fourth",
    ];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "new", line: "console.log(second)" },
      { type: "new", line: "console.log(third)" },
      { type: "same", line: "fourth" },
    ]);
  });

  test("remove multiple lines", async () => {
    const oldLines = [
      "console.log(first)",
      "console.log(second)",
      "console.log(third)",
      "fourth",
    ];
    const newLines = ["console.log(first)", "fourth"];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "same", line: "console.log(first)" },
      { type: "old", line: "console.log(second)" },
      { type: "old", line: "console.log(third)" },
      { type: "same", line: "fourth" },
    ]);
  });

  test("empty old lines", async () => {
    const oldLines: string[] = [];
    const newLines = ["console.log(first)", "console.log(second)"];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "new", line: "console.log(first)" },
      { type: "new", line: "console.log(second)" },
    ]);
  });

  test("empty new lines", async () => {
    const oldLines = ["console.log(first)", "console.log(second)"];
    const newLines: string[] = [];

    const diff = await collectDiff(oldLines, newLines);

    expect(diff).toEqual([
      { type: "old", line: "console.log(first)" },
      { type: "old", line: "console.log(second)" },
    ]);
  });
});
