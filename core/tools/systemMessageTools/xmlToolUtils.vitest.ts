import { describe, expect, test } from "vitest";
import { closeTag, splitAtTagBoundaries } from "./xmlToolUtils";

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

describe("splitAtTagBoundaries", () => {
  test("doesn't split plain text without tags", () => {
    expect(splitAtTagBoundaries("hello world")).toEqual(["hello world"]);
  });

  test("splits single complete tag", () => {
    expect(splitAtTagBoundaries("<tag>")).toEqual(["<tag>"]);
  });

  test("splits text with complete tag", () => {
    expect(splitAtTagBoundaries("before<tag>after")).toEqual([
      "before",
      "<tag>",
      "after",
    ]);
  });

  test("splits multiple complete tags", () => {
    expect(splitAtTagBoundaries("<one>middle<two>")).toEqual([
      "<one>",
      "middle",
      "<two>",
    ]);
  });

  test("handles partial opening tag", () => {
    expect(splitAtTagBoundaries("text<tag")).toEqual(["text", "<tag"]);
  });

  test("handles partial closing tag", () => {
    expect(splitAtTagBoundaries("text>")).toEqual(["text>"]);
  });

  test("handles empty string", () => {
    expect(splitAtTagBoundaries("")).toEqual([""]);
  });

  test("handles consecutive tag boundaries", () => {
    expect(splitAtTagBoundaries("<><>")).toEqual(["<>", "<>"]);
  });
});
