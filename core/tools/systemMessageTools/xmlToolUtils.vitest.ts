import { describe, expect, test } from "vitest";
import { closeTag } from "./xmlToolUtils";

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
