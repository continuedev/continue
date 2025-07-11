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
      { type: "same", char: "hello " },
      { type: "old", char: "wo" },
      { type: "new", char: "ea" },
      { type: "same", char: "r" },
      { type: "old", char: "ld" },
      { type: "new", char: "th" },
    ]);
  });

  test("should handle insertions", () => {
    const oldContent = "abc";
    const newContent = "abxyzc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "ab" },
      { type: "new", char: "xyz" },
      { type: "same", char: "c" },
    ]);
  });

  test("should handle deletions", () => {
    const oldContent = "abxyzc";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "ab" },
      { type: "old", char: "xyz" },
      { type: "same", char: "c" },
    ]);
  });

  test("should handle empty strings", () => {
    const oldContent = "";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([{ type: "new", char: "abc" }]);
  });

  test("should handle identical strings", () => {
    const content = "no changes here";

    const diffChars = myersCharDiff(content, content);
    expect(diffChars).toEqual([{ type: "same", char: "no changes here" }]);
  });

  test("should handle whitespace changes", () => {
    const oldContent = "hello world";
    const newContent = "hello  world";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "hello " },
      { type: "new", char: " " },
      { type: "same", char: "world" },
    ]);
  });

  test("should handle complex changes", () => {
    const oldContent = "The quick brown fox jumps over the lazy dog";
    const newContent = "The fast brown fox leaps over the sleeping dog";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      { type: "same", char: "The " },
      { type: "old", char: "quick" },
      { type: "new", char: "fast" },
      { type: "same", char: " brown fox " },
      { type: "old", char: "jum" },
      { type: "new", char: "lea" },
      { type: "same", char: "ps over the " },
      { type: "new", char: "s" },
      { type: "same", char: "l" },
      { type: "old", char: "azy" },
      { type: "new", char: "eeping" },
      { type: "same", char: " dog" },
    ]);
  });
});
