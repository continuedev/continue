import { describe, expect, test } from "vitest";
import { closeTag, splitAtTagsAndCodeblocks } from "./xmlToolUtils";

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

describe("splitAtTagsAndCodeblocks", () => {
  test("doesn't split plain text without tags", () => {
    expect(splitAtTagsAndCodeblocks("hello world")).toEqual(["hello world"]);
  });

  test("splits single complete tag", () => {
    expect(splitAtTagsAndCodeblocks("<tag>")).toEqual(["<tag>"]);
  });

  test("splits text with complete tag", () => {
    expect(splitAtTagsAndCodeblocks("before<tag>after")).toEqual([
      "before",
      "<tag>",
      "after",
    ]);
  });

  test("splits multiple complete tags", () => {
    expect(splitAtTagsAndCodeblocks("<one>middle<two>")).toEqual([
      "<one>",
      "middle",
      "<two>",
    ]);
  });

  test("splits at codeblocks", () => {
    expect(splitAtTagsAndCodeblocks("```<one>middle```<two>")).toEqual([
      "```",
      "<one>",
      "middle",
      "```",
      "<two>",
    ]);
  });

  test("handles partial opening tag", () => {
    expect(splitAtTagsAndCodeblocks("text<tag")).toEqual(["text", "<tag"]);
  });

  test("handles partial closing tag", () => {
    expect(splitAtTagsAndCodeblocks("text>")).toEqual(["text>"]);
  });

  test("handles empty string", () => {
    expect(splitAtTagsAndCodeblocks("")).toEqual([""]);
  });

  test("handles consecutive tag boundaries", () => {
    expect(splitAtTagsAndCodeblocks("<><>")).toEqual(["<>", "<>"]);
  });
});
