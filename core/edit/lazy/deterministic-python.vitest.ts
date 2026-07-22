import { describe, expect, test } from "vitest";

import { DiffLine } from "../..";
import { streamDiff } from "../../diff/streamDiff";

async function* toLineStream(
  lines: string[],
): AsyncGenerator<string, void, unknown> {
  for (const line of lines) {
    yield line;
  }
}

async function collectStreamDiff(
  oldText: string,
  newText: string,
  filename: string,
): Promise<DiffLine[]> {
  const oldLines = oldText.split("\n");
  const newLines = toLineStream(newText.split("\n"));
  const diffs: DiffLine[] = [];
  for await (const line of streamDiff(oldLines, newLines, filename)) {
    diffs.push(line);
  }
  return diffs;
}

describe("streamDiff python indentation awareness", () => {
  test("treats indentation changes as real diffs for .py files", async () => {
    const oldText = 'def hello():\n    print("world")';
    const newText = 'def hello():\n  print("world")';

    const diffs = await collectStreamDiff(oldText, newText, "example.py");

    const newLines = diffs.filter((d) => d.type === "new").map((d) => d.line);
    const oldLines = diffs.filter((d) => d.type === "old").map((d) => d.line);
    expect(newLines).toContain('  print("world")');
    expect(oldLines).toContain('    print("world")');
  });

  test("still treats indentation as cosmetic for non-python files", async () => {
    const oldText = 'function hello() {\n    console.log("world");\n}';
    const newText = 'function hello() {\n  console.log("world");\n}';

    const diffs = await collectStreamDiff(oldText, newText, "example.js");

    const allSame = diffs.every((d) => d.type === "same");
    expect(allSame).toBe(true);
  });
});
