import { describe, expect, test } from "vitest";

import { dedent } from "../util";

import { myersCharDiff, myersDiff } from "./myers";

describe("Test myers diff function", () => {
  test("should ...", () => {
    const linesA = dedent`
              A
              B
              C
              D
              E
            `;
    const linesB = dedent`
              A
              B
              C'
              D'
              E
            `;
    const diffLines = myersDiff(linesA, linesB);
    expect(diffLines).toEqual([
      { type: "same", line: "A" },
      { type: "same", line: "B" },
      { type: "old", line: "C" },
      { type: "old", line: "D" },
      { type: "new", line: "C'" },
      { type: "new", line: "D'" },
      { type: "same", line: "E" },
    ]);
  });

  test("should ignore newline differences at end", () => {
    const linesA = "A\nB\nC\n";
    const linesB = "A\nB\nC";

    const diffLines = myersDiff(linesA, linesB);
    expect(diffLines).toEqual([
      { type: "same", line: "A" },
      { type: "same", line: "B" },
      { type: "same", line: "C" },
    ]);
  });

  test("should ignore single-line whitespace-only differences", () => {
    const linesA = "A\n    B\nC\n";
    const linesB = "A\nB\nC";

    const diffLines = myersDiff(linesA, linesB);
    expect(diffLines).toEqual([
      { type: "same", line: "A" },
      { type: "same", line: "    B" },
      { type: "same", line: "C" },
    ]);
  });
});

describe("Test myersCharDiff function", () => {
  test("should differentiate character changes", () => {
    const oldContent = "hello world";
    const newContent = "hello earth";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "hello ", oldIndex: 0, newIndex: 0 },
      { type: "old", char: "wo", oldIndex: 6 },
      { type: "new", char: "ea", newIndex: 6 },
      { type: "same", char: "r", oldIndex: 8, newIndex: 8 },
      { type: "old", char: "ld", oldIndex: 9 },
      { type: "new", char: "th", newIndex: 9 },
    ]);
  });

  test("should handle insertions", () => {
    const oldContent = "abc";
    const newContent = "abxyzc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "ab", oldIndex: 0, newIndex: 0 },
      { type: "new", char: "xyz", newIndex: 2 },
      { type: "same", char: "c", oldIndex: 2, newIndex: 5 },
    ]);
  });

  test("should handle deletions", () => {
    const oldContent = "abxyzc";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "ab", oldIndex: 0, newIndex: 0 },
      { type: "old", char: "xyz", oldIndex: 2 },
      { type: "same", char: "c", oldIndex: 5, newIndex: 2 },
    ]);
  });

  test("should handle empty strings", () => {
    const oldContent = "";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([{ type: "new", char: "abc", newIndex: 0 }]);
  });

  test("should handle identical strings", () => {
    const content = "no changes here";

    const diffChars = myersCharDiff(content, content);
    expect(diffChars).toEqual([
      { type: "same", char: "no changes here", oldIndex: 0, newIndex: 0 },
    ]);
  });

  test("should handle whitespace changes", () => {
    const oldContent = "hello world";
    const newContent = "hello  world";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "hello ", oldIndex: 0, newIndex: 0 },
      { type: "new", char: " ", newIndex: 6 },
      { type: "same", char: "world", oldIndex: 6, newIndex: 7 },
    ]);
  });

  test("should handle complex changes", () => {
    const oldContent = "The quick brown fox jumps over the lazy dog";
    const newContent = "The fast brown fox leaps over the sleeping dog";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "The ", oldIndex: 0, newIndex: 0 },
      { type: "old", char: "quick", oldIndex: 4 },
      { type: "new", char: "fast", newIndex: 4 },
      { type: "same", char: " brown fox ", oldIndex: 9, newIndex: 8 },
      { type: "old", char: "jum", oldIndex: 20 },
      { type: "new", char: "lea", newIndex: 19 },
      { type: "same", char: "ps over the ", oldIndex: 23, newIndex: 22 },
      { type: "new", char: "s", newIndex: 34 },
      { type: "same", char: "l", oldIndex: 35, newIndex: 35 },
      { type: "old", char: "azy", oldIndex: 36 },
      { type: "new", char: "eeping", newIndex: 36 },
      { type: "same", char: " dog", oldIndex: 39, newIndex: 42 },
    ]);
  });
});
