import { expect, test } from "vitest";
import { isOpeningNestedBlock } from "./isOpeningNestedBlock";

test("isOpeningNestedBlock should return true when odd number of bare backticks ahead", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: should be opening (1 ``` ahead = odd)
    "content",

    "```", // <- index 4: closing (0 ``` ahead = even)
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(true);
  expect(isOpeningNestedBlock(trimmedLines, 4, 2)).toBe(false);
});

test("isOpeningNestedBlock should return false when even number (zero) of bare backticks ahead", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: should be closing (0 ``` ahead = even)
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should handle multiple nested pairs", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: opening (3 ``` ahead = odd)
    "```", // <- index 3: opening (2 ``` ahead = even) -> should be false
    "content",

    "```", // <- index 5: closing (1 ``` ahead = odd) -> should be true
    "```", // <- index 6: closing (0 ``` ahead = even) -> should be false
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(true); // 3 ahead = odd
  expect(isOpeningNestedBlock(trimmedLines, 3, 2)).toBe(false); // 2 ahead = even
  expect(isOpeningNestedBlock(trimmedLines, 5, 2)).toBe(true); // 1 ahead = odd
  expect(isOpeningNestedBlock(trimmedLines, 6, 1)).toBe(false); // 0 ahead = even
});

test("isOpeningNestedBlock should return false when reaching end of markdown block via ~~~", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: should be closing since ~~~ terminates the block
    "content",

    "~~~", // <- terminator stops counting
    "```", // <- this one is after the markdown block ends
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should return false when reaching new markdown block", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: should be closing since new markdown block starts
    "content",

    "```md", // <- new markdown block terminates counting
    "```", // <- this one belongs to the new block
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should handle empty content between backticks", () => {
  const trimmedLines = [
    "```markdown",

    "```", // <- index 1: opening (1 ``` ahead = odd)
    "",

    "```", // <- index 3: closing (0 ``` ahead = even)
  ];

  expect(isOpeningNestedBlock(trimmedLines, 1, 1)).toBe(true);
  expect(isOpeningNestedBlock(trimmedLines, 3, 2)).toBe(false);
});

test("isOpeningNestedBlock should handle case where currentIndex is last line", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: last line, should be closing (0 ahead = even)
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should not be confused by backticks in content", () => {
  const trimmedLines = [
    "```markdown",
    "Some `code` with backticks",

    "```", // <- index 2: should be closing (0 bare ``` ahead = even)
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should handle GitHub markdown variants as terminators", () => {
  const trimmedLines = [
    "```markdown",
    "# Header",

    "```", // <- index 2: should be closing (terminator stops counting)
    "content",

    "```gfm", // <- GitHub markdown variant starts new block
    "```",
  ];

  expect(isOpeningNestedBlock(trimmedLines, 2, 1)).toBe(false);
});

test("isOpeningNestedBlock should only check terminators at nest level 1", () => {
  const trimmedLines = [
    "```markdown",

    "```", // <- index 1: at nest level 1, ~~~ should terminate counting
    "~~~", // <- terminator found, stops counting
    "```", // <- this doesn't count towards the logic
  ];

  expect(isOpeningNestedBlock(trimmedLines, 1, 1)).toBe(false);
});

test("isOpeningNestedBlock should handle complex realistic markdown structure", () => {
  const trimmedLines = [
    "```markdown README.md",
    "# Project Structure",
    "",
    "```", // <- index 3: has 2 ``` ahead (even), so should be closing
    ".",
    "│   └── file.ts",
    "```", // <- index 7: has 1 ``` ahead (odd), so should be opening
    "```", // <- index 8: has 0 ``` ahead (even), so should be closing
  ];

  expect(isOpeningNestedBlock(trimmedLines, 3, 1)).toBe(false); // 2 ahead = even
  expect(isOpeningNestedBlock(trimmedLines, 7, 2)).toBe(true); // 1 ahead = odd
  expect(isOpeningNestedBlock(trimmedLines, 8, 1)).toBe(false); // 0 ahead = even
});
