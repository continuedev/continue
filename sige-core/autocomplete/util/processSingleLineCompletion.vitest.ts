import { describe, expect, it } from "vitest";
import { processTestCase } from "./completionTestUtils";
import { processSingleLineCompletion } from "./processSingleLineCompletion";

describe("processSingleLineCompletion", () => {
  it("should handle simple end of line completion", () => {
    const testCase = processTestCase({
      original: "console.log(|cur|",
      completion: '"Hello, world!")',
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });

  it("should handle midline insert repeating the end of line", () => {
    const testCase = processTestCase({
      original: "console.log(|cur|);|till|",
      completion: '"Hello, world!");',
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });

  it("should handle midline insert repeating the end of line plus adding a semicolon", () => {
    const testCase = processTestCase({
      original: "console.log(|cur|)|till|",
      completion: '"Hello, world!");',
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });

  it("should handle simple midline insert", () => {
    const testCase = processTestCase({
      original: "console.log(|cur|)",
      completion: '"Hello, world!"',
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });

  it("should handle complex dif with addition in the beginning", () => {
    const testCase = processTestCase({
      original: 'console.log(|cur||till|, "param1", )', // TODO
      completion: '"Hello world!", "param1", param1);',
      appliedCompletion: '"Hello world!"',
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });

  it("should handle simple insertion even with random equality", () => {
    const testCase = processTestCase({
      original: 'print(f"Foobar length: |cur||till|")',
      completion: "{len(foobar)}",
    });

    const result = processSingleLineCompletion(
      testCase.input.lastLineOfCompletionText,
      testCase.input.currentText,
      testCase.input.cursorPosition,
    );

    expect(result).toEqual(testCase.expectedResult);
  });
});
