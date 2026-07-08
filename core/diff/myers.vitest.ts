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

describe("Test myersCharDiff function on the same line", () => {
  test("should differentiate character changes", () => {
    const oldContent = "hello world";
    const newContent = "hello earth";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "hello ",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "wo",
        oldIndex: 6,
        oldCharIndexInLine: 6,
        oldLineIndex: 0,
      },
      {
        type: "new",
        char: "ea",
        newIndex: 6,
        newCharIndexInLine: 6,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "r",
        oldIndex: 8,
        newIndex: 8,
        oldCharIndexInLine: 8,
        newCharIndexInLine: 8,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "ld",
        oldIndex: 9,
        oldCharIndexInLine: 9,
        oldLineIndex: 0,
      },
      {
        type: "new",
        char: "th",
        newIndex: 9,
        newCharIndexInLine: 9,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle insertions", () => {
    const oldContent = "abc";
    const newContent = "abxyzc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "ab",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "new",
        char: "xyz",
        newIndex: 2,
        newCharIndexInLine: 2,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "c",
        oldIndex: 2,
        newIndex: 5,
        oldCharIndexInLine: 2,
        newCharIndexInLine: 5,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle deletions", () => {
    const oldContent = "abxyzc";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "ab",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "xyz",
        oldIndex: 2,
        oldCharIndexInLine: 2,
        oldLineIndex: 0,
      },
      {
        type: "same",
        char: "c",
        oldIndex: 5,
        newIndex: 2,
        oldCharIndexInLine: 5,
        newCharIndexInLine: 2,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle empty strings", () => {
    const oldContent = "";
    const newContent = "abc";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "new",
        char: "abc",
        newIndex: 0,
        newCharIndexInLine: 0,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle identical strings", () => {
    const content = "no changes here";

    const diffChars = myersCharDiff(content, content);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "no changes here",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle whitespace changes", () => {
    const oldContent = "hello world";
    const newContent = "hello  world";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "hello ",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "new",
        char: " ",
        newIndex: 6,
        newCharIndexInLine: 6,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "world",
        oldIndex: 6,
        newIndex: 7,
        oldCharIndexInLine: 6,
        newCharIndexInLine: 7,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
    ]);
  });

  test("should handle complex changes", () => {
    const oldContent = "The quick brown fox jumps over the lazy dog";
    const newContent = "The fast brown fox leaps over the sleeping dog";

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "The ",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "quick",
        oldIndex: 4,
        oldCharIndexInLine: 4,
        oldLineIndex: 0,
      },
      {
        type: "new",
        char: "fast",
        newIndex: 4,
        newCharIndexInLine: 4,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: " brown fox ",
        oldIndex: 9,
        newIndex: 8,
        oldCharIndexInLine: 9,
        newCharIndexInLine: 8,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "jum",
        oldIndex: 20,
        oldCharIndexInLine: 20,
        oldLineIndex: 0,
      },
      {
        type: "new",
        char: "lea",
        newIndex: 19,
        newCharIndexInLine: 19,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "ps over the ",
        oldIndex: 23,
        newIndex: 22,
        oldCharIndexInLine: 23,
        newCharIndexInLine: 22,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "new",
        char: "s",
        newIndex: 34,
        newCharIndexInLine: 34,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "l",
        oldIndex: 35,
        newIndex: 35,
        oldCharIndexInLine: 35,
        newCharIndexInLine: 35,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "azy",
        oldIndex: 36,
        oldCharIndexInLine: 36,
        oldLineIndex: 0,
      },
      {
        type: "new",
        char: "eeping",
        newIndex: 36,
        newCharIndexInLine: 36,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: " dog",
        oldIndex: 39,
        newIndex: 42,
        oldCharIndexInLine: 39,
        newCharIndexInLine: 42,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
    ]);
  });
});

describe("Test myersCharDiff function on different lines", () => {
  test("should track line indices for multi-line changes", () => {
    const oldContent = ["Line one", "Line two", "Line three"].join("\n");

    const newContent = ["Line one", "Modified line", "Line three"].join("\n");

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "Line one",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "\n",
        oldIndex: 8,
        newIndex: 8,
        oldCharIndexInLine: 8,
        newCharIndexInLine: 8,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "L",
        oldIndex: 9,
        oldCharIndexInLine: 0,
        oldLineIndex: 1,
      },
      {
        type: "new",
        char: "Mod",
        newIndex: 9,
        newCharIndexInLine: 0,
        newLineIndex: 1,
      },
      {
        char: "i",
        newCharIndexInLine: 3,
        newIndex: 12,
        newLineIndex: 1,
        oldCharIndexInLine: 1,
        oldIndex: 10,
        oldLineIndex: 1,
        type: "same",
      },
      {
        char: "n",
        oldCharIndexInLine: 2,
        oldIndex: 11,
        oldLineIndex: 1,
        type: "old",
      },
      {
        char: "fi",
        newCharIndexInLine: 4,
        newIndex: 13,
        newLineIndex: 1,
        type: "new",
      },
      {
        char: "e",
        newCharIndexInLine: 6,
        newIndex: 15,
        newLineIndex: 1,
        oldCharIndexInLine: 3,
        oldIndex: 12,
        oldLineIndex: 1,
        type: "same",
      },
      {
        char: "d",
        newCharIndexInLine: 7,
        newIndex: 16,
        newLineIndex: 1,
        type: "new",
      },
      {
        char: " ",
        newCharIndexInLine: 8,
        newIndex: 17,
        newLineIndex: 1,
        oldCharIndexInLine: 4,
        oldIndex: 13,
        oldLineIndex: 1,
        type: "same",
      },
      {
        type: "old",
        char: "two",
        oldCharIndexInLine: 5,
        oldIndex: 14,
        oldLineIndex: 1,
      },
      {
        type: "new",
        char: "line",
        newCharIndexInLine: 9,
        newIndex: 18,
        newLineIndex: 1,
      },
      {
        type: "same",
        char: "\n",
        oldIndex: 17,
        oldCharIndexInLine: 8,
        oldLineIndex: 1,
        newIndex: 22,
        newCharIndexInLine: 13,
        newLineIndex: 1,
      },
      {
        type: "same",
        char: "Line three",
        oldIndex: 18,
        newIndex: 23,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 2,
        newLineIndex: 2,
      },
    ]);
  });

  test("should track line indices when adding new lines", () => {
    const oldContent = ["First line", "Last line"].join("\n");

    const newContent = [
      "First line",
      "Middle line",
      "Another middle",
      "Last line",
    ].join("\n");

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "First line",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "\n",
        oldIndex: 10,
        newIndex: 10,
        oldCharIndexInLine: 10,
        newCharIndexInLine: 10,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "new",
        char: "Middle line",
        newIndex: 11,
        newCharIndexInLine: 0,
        newLineIndex: 1,
      },
      {
        type: "new",
        char: "\n",
        newIndex: 22,
        newCharIndexInLine: 11,
        newLineIndex: 1,
      },
      {
        type: "new",
        char: "Another middle",
        newCharIndexInLine: 0,
        newIndex: 23,
        newLineIndex: 2,
      },
      {
        type: "new",
        char: "\n",
        newCharIndexInLine: 14,
        newIndex: 37,
        newLineIndex: 2,
      },
      {
        type: "same",
        char: "Last line",
        oldIndex: 11,
        oldCharIndexInLine: 0,
        oldLineIndex: 1,
        newIndex: 38,
        newCharIndexInLine: 0,
        newLineIndex: 3,
      },
    ]);
  });

  test("should track line indices when removing lines", () => {
    const oldContent = [
      "Start",
      "Line to remove",
      "Another to remove",
      "End",
    ].join("\n");

    const newContent = ["Start", "End"].join("\n");

    const diffChars = myersCharDiff(oldContent, newContent);
    expect(diffChars).toEqual([
      {
        type: "same",
        char: "Start",
        oldIndex: 0,
        newIndex: 0,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "same",
        char: "\n",
        oldIndex: 5,
        newIndex: 5,
        oldCharIndexInLine: 5,
        newCharIndexInLine: 5,
        oldLineIndex: 0,
        newLineIndex: 0,
      },
      {
        type: "old",
        char: "Line to remove",
        oldIndex: 6,
        oldCharIndexInLine: 0,
        oldLineIndex: 1,
      },
      {
        type: "old",
        char: "\n",
        oldCharIndexInLine: 14,
        oldIndex: 20,
        oldLineIndex: 1,
      },
      {
        type: "old",
        char: "Another to remove",
        oldCharIndexInLine: 0,
        oldIndex: 21,
        oldLineIndex: 2,
      },
      {
        type: "old",
        char: "\n",
        oldCharIndexInLine: 17,
        oldIndex: 38,
        oldLineIndex: 2,
      },
      {
        type: "same",
        char: "End",
        oldIndex: 39,
        newIndex: 6,
        oldCharIndexInLine: 0,
        newCharIndexInLine: 0,
        oldLineIndex: 3,
        newLineIndex: 1,
      },
    ]);
  });
});
