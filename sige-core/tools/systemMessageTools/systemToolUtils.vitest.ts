import { describe, expect, test } from "vitest";
import { closeTag, splitAtCodeblocksAndNewLines } from "./systemToolUtils";

describe("closeTag", () => {
  const testCases = [
    {
      input: "<div>",
      expectedOutput: "</div>",
    },
    {
      input: "<p>",
      expectedOutput: "</p>",
    },
    // Add more test cases as needed
  ];

  testCases.forEach((testCase) => {
    test(`closes tag "${testCase.input}" to "</${testCase.input.slice(1)}"`, () => {
      const result = closeTag(testCase.input);
      expect(result).toEqual(testCase.expectedOutput);
    });
  });
});

describe("splitAtCodeblocks", () => {
  test("doesn't split plain text without codeblocks", () => {
    expect(splitAtCodeblocksAndNewLines("hello world")).toEqual([
      "hello world",
    ]);
  });

  test("splits at codeblocks", () => {
    expect(splitAtCodeblocksAndNewLines("```<one>middle```<two>")).toEqual([
      "```",
      "<one>middle",
      "```",
      "<two>",
    ]);
  });

  test("splits at new lines", () => {
    expect(splitAtCodeblocksAndNewLines("hello\nhoware\n you\n")).toEqual([
      "hello",
      "\n",
      "howare",
      "\n",
      " you",
      "\n",
    ]);
  });

  test("splits at both codeblocks and new lines", () => {
    expect(splitAtCodeblocksAndNewLines("hello```\nho```ware\n you\n")).toEqual(
      ["hello", "```", "\n", "ho", "```", "ware", "\n", " you", "\n"],
    );
  });
});
