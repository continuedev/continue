import { stopNCharsAfterClosingBracket } from "./lineStream";

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

  test("should yield all lines when no unmatched brackets", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should yield all lines when >20 chars after brackets but brackets are matched", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
      "// End of function and start of something else",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should stop yielding after 20 chars when unmatched closing bracket is found", async () => {
    const inputLines = [
      //   "function test() {",
      '  console.log("Hello World");',
      // Unmatched closing bracket
      "}",
      "1234567890123456789",
      'console.log("End");',
    ];
    const expectedOutputLines = [
      '  console.log("Hello World");',
      "}",
      "1234567890123456789",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(expectedOutputLines);
  });

  test("should stop yielding after 2 chars when unmatched closing bracket is found", async () => {
    const inputLines = [
      //   "function test() {",
      '  console.log("Hello World");',
      // Unmatched closing bracket
      "}",
      "12",
      'console.log("End");',
    ];
    const expectedOutputLines = ['  console.log("Hello World");', "}", "1"];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines, 2),
    );

    expect(outputLines).toEqual(expectedOutputLines);
  });

  test("should stop yielding after 4 chars when unmatched closing bracket is found, on same line", async () => {
    const inputLines = [
      //   "function test() {",
      '  console.log("Hello World");',
      // Unmatched closing bracket
      "}23456",
    ];
    const expectedOutputLines = ['  console.log("Hello World");', "}234"];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines, 4),
    );

    expect(outputLines).toEqual(expectedOutputLines);
  });

  test("should yield all lines when unmatched brackets but less <20 chars after", async () => {
    const inputLines = [
      "function test() {",
      '  console.log("Hello World");',
      "}",
      // Unmatched closing bracket
      ")",
      "// Continue code",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });

  test("should yield all lines when brackets are matched even with many characters", async () => {
    const inputLines = [
      "const arr = [",
      "  1, 2, 3,",
      "];",
      "",
      "",
      "console.log(arr);",
      "console.log(arr);",
      "console.log(arr);",
      "console.log(arr);",
      "console.log(arr);",
      "console.log(arr);",
    ];
    const lines = arrayToAsyncGenerator(inputLines);
    const outputLines = await collectLines(
      stopNCharsAfterClosingBracket(lines),
    );

    expect(outputLines).toEqual(inputLines);
  });
});
