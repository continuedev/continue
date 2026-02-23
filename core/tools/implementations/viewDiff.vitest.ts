import { expect, test, vi } from "vitest";
import { DEFAULT_GIT_DIFF_LINE_LIMIT, viewDiffImpl } from "./viewDiff";

// Mock the getDiffsFromCache function
vi.mock("../../autocomplete/snippets/gitDiffCache", () => ({
  getDiffsFromCache: vi.fn(),
}));

import { ToolExtras } from "../..";
import { getDiffsFromCache } from "../../autocomplete/snippets/gitDiffCache";
const mockExtras = {
  fetch: vi.fn() as any,
  ide: {} as any,
} as unknown as ToolExtras;

test("viewDiff should not truncate diffs under line limit", async () => {
  // Create a small diff with just a few lines
  const smallDiff = [
    "diff --git a/file1.txt b/file1.txt",
    "index 1234..5678 100644",
    "--- a/file1.txt",
    "+++ b/file1.txt",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-line2",
    "+line2 modified",
    "+line3 added",
  ];

  (getDiffsFromCache as any).mockResolvedValue(smallDiff);

  const result = await viewDiffImpl({}, mockExtras);

  expect(result).toHaveLength(1); // Just the diff, no warning
  expect(result[0].name).toBe("Diff");
  expect(result[0].content).toBe(smallDiff.join("\n"));
});

test("viewDiff should truncate diffs exceeding line limit", async () => {
  // Create a large diff that exceeds the line limit
  const largeDiffLines = Array(DEFAULT_GIT_DIFF_LINE_LIMIT + 1000).fill(
    "line content",
  );
  const largeDiff = [
    "diff --git a/file1.txt b/file1.txt",
    "index 1234..5678 100644",
    ...largeDiffLines,
  ];

  (getDiffsFromCache as any).mockResolvedValue([largeDiff.join("\n")]);

  const result = await viewDiffImpl({}, mockExtras);

  expect(result).toHaveLength(2); // Diff + warning

  // Count the number of lines in the result
  const resultLines = result[0].content.split("\n");
  expect(resultLines.length).toBe(DEFAULT_GIT_DIFF_LINE_LIMIT);

  // Check the warning
  expect(result[1].name).toBe("Truncation warning");
  expect(result[1].content).toContain("truncated");
  expect(result[1].content).toContain(`${DEFAULT_GIT_DIFF_LINE_LIMIT} lines`);
});

test("viewDiff should handle multiple diffs correctly", async () => {
  const DEFAULT_GIT_DIFF_LINE_LIMIT = 5000;

  // Create multiple diffs that together exceed the line limit
  const diff1Lines = Array(3000).fill("diff1 line");
  const diff2Lines = Array(3000).fill("diff2 line");
  const diff1 = diff1Lines.join("\n");
  const diff2 = diff2Lines.join("\n");

  (getDiffsFromCache as any).mockResolvedValue([diff1, diff2]);

  const result = await viewDiffImpl({}, mockExtras);

  expect(result).toHaveLength(2); // Diff + warning

  // Count the number of lines in the result
  const resultLines = result[0].content.split("\n");
  expect(resultLines.length).toBe(DEFAULT_GIT_DIFF_LINE_LIMIT);

  // Check the warning
  expect(result[1].name).toBe("Truncation warning");
});
