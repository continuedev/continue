import { jest } from "@jest/globals";

import * as lineStream from "./lineStream";

// eslint-disable-next-line max-lines-per-function
describe("lineStream", () => {
  let mockFullStop: jest.Mock;

  async function getLineGenerator(lines: any) {
    return (async function* () {
      for (const line of lines) {
        yield line;
      }
    })();
  }

  async function getFilteredLines(results: any) {
    const output = [];

    for await (const line of results) {
      output.push(line);
    }

    return output;
  }

  beforeEach(() => {
    mockFullStop = jest.fn();
  });

  describe("noTopLevelKeywordsMidline", () => {
    it.todo("Need some sample inputs to properly test this");
  });

  describe("avoidPathLine", () => {
    it("should filter out path lines", async () => {
      const linesGenerator = await getLineGenerator([
        "// Path: src/index.ts",
        "const x = 5;",
        "//",
        "console.log(x);",
      ]);
      const result = lineStream.avoidPathLine(linesGenerator, "//");
      const filteredLines = await getFilteredLines(result);
      expect(filteredLines).toEqual(["const x = 5;", "//", "console.log(x);"]);
    });
  });

  describe("avoidEmptyComments", () => {
    it("should filter out empty comments", async () => {
      const linesGenerator = await getLineGenerator([
        "// Path: src/index.ts",
        "const x = 5;",
        "//",
        "console.log(x);",
      ]);
      const result = lineStream.avoidEmptyComments(linesGenerator, "//");
      const filteredLines = await getFilteredLines(result);
      expect(filteredLines).toEqual([
        "// Path: src/index.ts",
        "const x = 5;",
        "console.log(x);",
      ]);
    });
  });

  describe("streamWithNewLines", () => {
    it("should add newlines between lines", async () => {
      const linesGenerator = await getLineGenerator([
        "line1",
        "line2",
        "line3",
      ]);

      const result = lineStream.streamWithNewLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["line1", "\n", "line2", "\n", "line3"]);
    });
  });

  describe("lineIsRepeated", () => {
    it("should return true for similar lines", () => {
      expect(lineStream.lineIsRepeated("const x = 5;", "const x = 6;")).toBe(
        true,
      );
    });

    it("should return false for different lines", () => {
      expect(lineStream.lineIsRepeated("const x = 5;", "let y = 10;")).toBe(
        false,
      );
    });

    it("should return false for short lines", () => {
      expect(lineStream.lineIsRepeated("x=5", "x=6")).toBe(false);
    });
  });

  describe("stopAtSimilarLine", () => {
    it("should stop at the exact same line", async () => {
      const lineToTest = "const x = 6";
      const linesGenerator = await getLineGenerator([
        "console.log();",
        "const y = () => {};",
        lineToTest,
      ]);

      const result = lineStream.stopAtSimilarLine(
        linesGenerator,
        lineToTest,
        mockFullStop,
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["console.log();", "const y = () => {};"]);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });

    it("should stop at a similar line", async () => {
      const lineToTest = "const x = 6;";
      const linesGenerator = await getLineGenerator([
        "console.log();",
        "const y = () => {};",
        lineToTest,
      ]);

      const result = lineStream.stopAtSimilarLine(
        linesGenerator,
        "a" + lineToTest,
        mockFullStop,
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["console.log();", "const y = () => {};"]);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });

    it("should continue on bracket ending lines", async () => {
      const linesGenerator = await getLineGenerator([
        " if (x > 0) {",
        "   console.log(x);",
        " }",
      ]);

      const result = lineStream.stopAtSimilarLine(
        linesGenerator,
        "}",
        mockFullStop,
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        " if (x > 0) {",
        "   console.log(x);",
        " }",
      ]);
      expect(mockFullStop).toHaveBeenCalledTimes(0);
    });
  });

  describe("stopAtLines", () => {
    it("should stop at specified lines", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
        lineStream.LINES_TO_STOP_AT[0],
        "const z = 15;",
      ]);

      const result = lineStream.stopAtLines(linesGenerator, mockFullStop);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });
  });

  describe("skipPrefixes", () => {
    it("should skip specified prefixes", async () => {
      const linesGenerator = await getLineGenerator([
        `${lineStream.PREFIXES_TO_SKIP[0]}const x = 5;`,
        "let y = 10;",
      ]);

      const result = lineStream.skipPrefixes(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
    });
  });

  describe("skipLines", () => {
    it("should skip specified lines", async () => {
      const linesGenerator = await getLineGenerator([
        `${lineStream.LINES_TO_SKIP[0]}const x = 5;`,
        "let y = 10;",
      ]);

      const result = lineStream.skipLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["let y = 10;"]);
    });
  });

  describe("filterCodeBlockLines", () => {
    it("should handle unfenced code", async () => {
      const linesGenerator = await getLineGenerator(["const x = 5;"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should handle unfenced code with a code block", async () => {
      const linesGenerator = await getLineGenerator(["const x = 5;","```bash","ls -al","```"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```"]);
    });

    it("should handle unfenced code with two code blocks", async () => {
      const linesGenerator = await getLineGenerator(["const x = 5;","```bash","ls -al","```","```bash","ls -al","```"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```","```bash","ls -al","```"]);
    });

    it("should remove lines before the first valid line", async () => {
      const linesGenerator = await getLineGenerator(["```ts", "const x = 5;"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should remove outer blocks", async () => {
      const linesGenerator = await getLineGenerator(["```ts", "const x = 5;","```"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should leave inner blocks intact", async () => {
      const linesGenerator = await getLineGenerator(["```md", "const x = 5;", "```bash","ls -al","```","```"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```"]);
    });

    it("should handle included inner ticks", async () => {
      const linesGenerator = await getLineGenerator(["```md", "const x = 5;", "```bash","echo ```test```","```","```"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","echo ```test```","```"]);
    });

    it("should leave single inner blocks intact but not return trailing text", async () => {
      const linesGenerator = await getLineGenerator(["```md", "const x = 5;", "```bash","ls -al","```","```","trailing text"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```"]);
    });

    it("should leave double inner blocks intact but not return trailing text", async () => {
      const linesGenerator = await getLineGenerator(["```md", "const x = 5;", "```bash","ls -al","```","const y = 10;","```sh","echo `hello world`","```","```","trailing text"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```","const y = 10;","```sh","echo `hello world`","```"]);
    });

    it("should leave inner blocks intact but not return trailing or leading text", async () => {
      const linesGenerator = await getLineGenerator(["[CODE]", "const x = 5;", "```bash","ls -al","```","[/CODE]","trailing text"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;","```bash","ls -al","```"]);
    });
  });

  describe("filterEnglishLinesAtStart", () => {
    it("should skip initial empty line", async () => {
      const linesGenerator = await getLineGenerator([
        "",
        "const x = 5;",
        "let y = 10;",
      ]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
    });

    it("should filter out English first line", async () => {
      const linesGenerator = await getLineGenerator([
        lineStream.ENGLISH_START_PHRASES[0],
        "let y = 10;",
      ]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["let y = 10;"]);
    });

    it("should not filter out non-English first line", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
      ]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
    });

    it("should filter out empty newline after first line english word", async () => {
      const linesGenerator = await getLineGenerator([
        lineStream.ENGLISH_START_PHRASES[0],
        "",
        "const x = 5;",
      ]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should filter out sentences ending in a semi-colon that are not code keywords", async () => {
      const linesGenerator = await getLineGenerator([
        "a" + lineStream.CODE_KEYWORDS_ENDING_IN_SEMICOLON[0] + ":",
        "const x = 5;",
      ]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should not filter out sentences ending in a semi-colon that are code keywords", async () => {
      const keyword = lineStream.CODE_KEYWORDS_ENDING_IN_SEMICOLON[0] + ":";

      const linesGenerator = await getLineGenerator([keyword, "const x = 5;"]);

      const result = lineStream.filterEnglishLinesAtStart(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([keyword, "const x = 5;"]);
    });
  });

  describe("filterEnglishLinesAtEnd", () => {
    it("should stop at English explanation after code block", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "```",
        lineStream.ENGLISH_POST_PHRASES[0],
      ]);

      const result = lineStream.filterEnglishLinesAtEnd(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "```"]);
    });
  });

  describe("fixCodeLlamaFirstLineIndentation", () => {
    it("should fix indentation of the first line", async () => {
      const linesGenerator = await getLineGenerator([
        "  const x = 5;",
        "let y = 10;",
      ]);

      const result =
        lineStream.fixCodeLlamaFirstLineIndentation(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
    });
  });

  describe("filterLeadingAndTrailingNewLineInsertion", () => {
    it("should ignore 'useless' new first lines", async () => {
      const linesGenerator = await getLineGenerator([
        { type: "new", line: lineStream.USELESS_LINES[0] },
        { type: "new", line: "const x = 5;" },
      ]);

      const result =
        lineStream.filterLeadingAndTrailingNewLineInsertion(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([{ type: "new", line: "const x = 5;" }]);
    });

    it("should handle preserve newlines chars in old lines", async () => {
      const linesGenerator = await getLineGenerator([
        { type: "new", line: "const x = 5;" },
        { type: "old", line: "let y = 10;" },
        { type: "old", line: "" },
        { type: "new", line: "const z = 15;" },
      ]);

      const result =
        lineStream.filterLeadingAndTrailingNewLineInsertion(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        { type: "new", line: "const x = 5;" },
        { type: "old", line: "let y = 10;" },
        { type: "old", line: "" },
        { type: "new", line: "const z = 15;" },
      ]);
    });

    it("should filter leading and trailing new line insertions", async () => {
      const linesGenerator = await getLineGenerator([
        { type: "new", line: "" },
        { type: "new", line: "const x = 5;" },
        { type: "new", line: "let y = 10;" },
        { type: "new", line: "" },
      ]);

      const result =
        lineStream.filterLeadingAndTrailingNewLineInsertion(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        { type: "new", line: "const x = 5;" },
        { type: "new", line: "let y = 10;" },
      ]);
    });

    it("should buffer newline chars and then render them if we encounter another non-empty line", async () => {
      const linesGenerator = await getLineGenerator([
        { type: "new", line: "const x = 5;" },
        { type: "new", line: "" },
        { type: "new", line: "let y = 10;" },
      ]);

      const result =
        lineStream.filterLeadingAndTrailingNewLineInsertion(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        { type: "new", line: "const x = 5;" },
        { type: "new", line: "" },
        { type: "new", line: "let y = 10;" },
      ]);
    });
  });

  describe("stopAtRepeatingLines", () => {
    it("should handle non-repeating lines correctly", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
        "const z = 15;",
      ]);

      const result = lineStream.stopAtRepeatingLines(
        linesGenerator,
        mockFullStop,
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "let y = 10;",
        "const z = 15;",
      ]);
    });

    it("should stop at repeating lines", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
        "let y = 10;",
        "let y = 10;",
        "const z = 15;",
      ]);

      const result = lineStream.stopAtRepeatingLines(
        linesGenerator,
        mockFullStop,
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });
  });
});
