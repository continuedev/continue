import { noDoubleNewlineAfterClosingBracket } from "./lineStream";

describe("noDoubleNewlineAfterClosingBracket", () => {
  // Helper function to convert an array to an async generator
  async function* arrayToAsyncGenerator<T>(array: T[]): AsyncGenerator<T> {
    for (const item of array) {
      yield item;
    }
  }

  // Helper function to collect lines from the async generator
  async function collectLines(lines: AsyncIterable<string>): Promise<string[]> {
    const result: string[] = [];
    for await (const line of lines) {
      result.push(line);
    }
    return result;
  }

  test("should yield all lines when no double newline and no unmatched brackets", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should yield all lines when double newline but brackets are matched", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
      "",
      "",
      "// End of function",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should stop yielding after double newline when unmatched closing bracket is found before double newline", async () => {
    const inputLines = [
      //   "function test() {",
      '  console.log("Hello World");',
      // Unmatched closing bracket
      "}",
      "",
      "",
      "// This should not be yielded",
      'console.log("End");',
    ];
    const expectedOutputLines = ['  console.log("Hello World");', "}"];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(expectedOutputLines);
  });

  test("should yield all lines when unmatched brackets but no double newline", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
      // Unmatched closing bracket
      ")",
      "// Continue code",
      'console.log("End");',
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should continue yielding if unmatched closing bracket occurs after double newline", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
      "",
      "",
      // Unmatched closing bracket after double newline
      ")",
      'console.log("End");',
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should yield all lines when brackets are matched even with double newline", async () => {
    const inputLines = [
      "const arr = [",
      "  1, 2, 3,",
      "];",
      "",
      "",
      "console.log(arr);",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should stop yielding when unmatched closing bracket occurs before double newline", async () => {
    const inputLines = [
      "if (condition) {",
      "  doSomething();",
      "}",
      // Unmatched closing bracket
      "}",
      "",
      "",
      "doSomethingElse();",
    ];
    const expectedOutputLines = [
      "if (condition) {",
      "  doSomething();",
      "}",
      "}",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(expectedOutputLines);
  });

  test("should yield all lines when no unmatched closing brackets and double newline", async () => {
    const inputLines = [
      "while (true) {",
      "  // Infinite loop",
      "}",
      "",
      "",
      "// Loop exited",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      noDoubleNewlineAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });
});
