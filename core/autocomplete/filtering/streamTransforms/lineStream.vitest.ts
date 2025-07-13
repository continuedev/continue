import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import {
  collectAllLines,
  MarkdownBlockStateTracker,
} from "../../../utils/markdownUtils";
import { shouldStopAtMarkdownBlock } from "../../../utils/streamMarkdownUtils";
import * as lineStream from "./lineStream";

// eslint-disable-next-line max-lines-per-function
describe("lineStream", () => {
  let mockFullStop: Mock;

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
    mockFullStop = vi.fn();
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

    it("should stop at lines with leading whitespace", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
        `    ${lineStream.LINES_TO_STOP_AT[0]}`,
        "const z = 15;",
      ]);

      const result = lineStream.stopAtLines(linesGenerator, mockFullStop);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;", "let y = 10;"]);
      expect(mockFullStop).toHaveBeenCalledTimes(1);
    });

    it("should NOT stop when stop phrase is inside quotes", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        'console.log("# End of file. not really");',
        "let y = 10;",
        "const z = 15;",
      ]);

      const result = lineStream.stopAtLines(linesGenerator, mockFullStop);
      const filteredLines = await getFilteredLines(result);

      // Should not stop, should yield all lines
      expect(filteredLines).toEqual([
        "const x = 5;",
        'console.log("# End of file. not really");',
        "let y = 10;",
        "const z = 15;",
      ]);
      expect(mockFullStop).toHaveBeenCalledTimes(0);
    });

    it("should NOT stop when stop phrase is inside single quotes", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "const message = '# End of file. not really';",
        "let y = 10;",
      ]);

      const result = lineStream.stopAtLines(linesGenerator, mockFullStop);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "const message = '# End of file. not really';",
        "let y = 10;",
      ]);
      expect(mockFullStop).toHaveBeenCalledTimes(0);
    });

    it("should NOT stop when stop phrase is part of larger text", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "// This function stops<STOP EDITING HERE>after processing",
        "let y = 10;",
      ]);

      const result = lineStream.stopAtLines(linesGenerator, mockFullStop);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "// This function stops<STOP EDITING HERE>after processing",
        "let y = 10;",
      ]);
      expect(mockFullStop).toHaveBeenCalledTimes(0);
    });

    it("should stop when stop phrase appears properly at start of content", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "let y = 10;",
        "# End of file. Done here",
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
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
      ]);
    });

    it("should handle unfenced code with two code blocks", async () => {
      const linesGenerator = await getLineGenerator([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "```bash",
        "ls -al",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "```bash",
        "ls -al",
        "```",
      ]);
    });

    it("should remove lines before the first valid line", async () => {
      const linesGenerator = await getLineGenerator(["```ts", "const x = 5;"]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should remove outer blocks", async () => {
      const linesGenerator = await getLineGenerator([
        "```ts",
        "const x = 5;",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should leave inner blocks intact", async () => {
      const linesGenerator = await getLineGenerator([
        "```md",
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
      ]);
    });

    it("should ignore ticks inside of code blocks such as tests", async () => {
      const linesGenerator = await getLineGenerator([
        "```typescript",
        'it("should handle included inner ticks", async () => {',
        " const linesGenerator = await getLineGenerator([`",
        ' "```md"',
        ' "const x = 5;"',
        ' "```bash"',
        ' "echo ```test```"',
        ' "```"',
        ' "```"',
        "]);",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        'it("should handle included inner ticks", async () => {',
        " const linesGenerator = await getLineGenerator([`",
        ' "```md"',
        ' "const x = 5;"',
        ' "```bash"',
        ' "echo ```test```"',
        ' "```"',
        ' "```"',
        "]);",
      ]);
    });

    it("should handle included inner ticks", async () => {
      const linesGenerator = await getLineGenerator([
        "```md",
        "const x = 5;",
        "```bash",
        "echo ```test```",
        "```",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "echo ```test```",
        "```",
      ]);
    });

    it("should leave single inner blocks intact but not return trailing text", async () => {
      const linesGenerator = await getLineGenerator([
        "```md",
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "```",
        "trailing text",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
      ]);
    });

    it("should leave double inner blocks intact but not return trailing text", async () => {
      const linesGenerator = await getLineGenerator([
        "```md",
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "const y = 10;",
        "```sh",
        "echo `hello world`",
        "```",
        "```",
        "trailing text",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "const y = 10;",
        "```sh",
        "echo `hello world`",
        "```",
      ]);
    });

    it("should leave inner blocks intact but not return trailing or leading text", async () => {
      const linesGenerator = await getLineGenerator([
        "[CODE]",
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
        "[/CODE]",
        "trailing text",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "const x = 5;",
        "```bash",
        "ls -al",
        "```",
      ]);
    });

    // Markdown-aware tests
    it("should handle markdown files with nested code blocks and a filename is included", async () => {
      const linesGenerator = await getLineGenerator([
        "```markdown README.md",
        "# Project Structure",
        "",
        "```",
        "debug-test-folder/",
        "├── AdvancedPage.tsx",
        "├── Calculator.java",
        "└── test.ts",
        "```",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(
        linesGenerator,
        "README.md",
      );
      const filteredLines = await getFilteredLines(result);

      // Should include all content up to the final closing ```
      expect(filteredLines).toEqual([
        "# Project Structure",
        "",
        "```",
        "debug-test-folder/",
        "├── AdvancedPage.tsx",
        "├── Calculator.java",
        "└── test.ts",
        "```",
      ]);
    });

    // Markdown-aware tests
    it("should handle markdown files with nested code blocks and a filename is excluded", async () => {
      const linesGenerator = await getLineGenerator([
        "```markdown README.md",
        "# Project Structure",
        "",
        "```",
        "debug-test-folder/",
        "├── AdvancedPage.tsx",
        "├── Calculator.java",
        "└── test.ts",
        "```",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      // Should include all content up to the final closing ```
      expect(filteredLines).toEqual([
        "# Project Structure",
        "",
        "```",
        "debug-test-folder/",
        "├── AdvancedPage.tsx",
        "├── Calculator.java",
        "└── test.ts",
        "```",
      ]);
    });

    it("should handle non-markdown files normally with filepath parameter", async () => {
      const linesGenerator = await getLineGenerator([
        "```",
        "function test() {",
        "  return 'hello';",
        "}",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator, "test.js");
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "function test() {",
        "  return 'hello';",
        "}",
      ]);
    });

    it("should handle simple markdown code blocks", async () => {
      const linesGenerator = await getLineGenerator([
        "```",
        "Here's some code:",
        "```",
        "function example() {",
        "  console.log('test');",
        "}",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(
        linesGenerator,
        "README.md",
      );
      const filteredLines = await getFilteredLines(result);

      // Should remove the outer markdown wrapper, and return just the inner content.
      // The lack of an end tag should cause it to return all remaining lines.
      expect(filteredLines).toEqual([
        "Here's some code:",
        "```",
        "function example() {",
        "  console.log('test');",
        "}",
        "```",
      ]);
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

  // Tests for new helper functions

  describe("hasNestedMarkdownBlocks", () => {
    it("should detect nested markdown blocks from first line", () => {
      expect(lineStream.hasNestedMarkdownBlocks("```markdown", undefined)).toBe(
        true,
      );
      expect(lineStream.hasNestedMarkdownBlocks("```md", undefined)).toBe(true);
      expect(lineStream.hasNestedMarkdownBlocks("```gfm", undefined)).toBe(
        true,
      );
    });

    it("should detect nested markdown blocks from filepath", () => {
      expect(
        lineStream.hasNestedMarkdownBlocks("```typescript", "README.md"),
      ).toBe(true);
      expect(
        lineStream.hasNestedMarkdownBlocks("```javascript", "docs.markdown"),
      ).toBe(true);
    });

    it("should return false for non-markdown scenarios", () => {
      expect(
        lineStream.hasNestedMarkdownBlocks("```typescript", "script.js"),
      ).toBe(false);
      expect(lineStream.hasNestedMarkdownBlocks("```python", undefined)).toBe(
        false,
      );
      expect(
        lineStream.hasNestedMarkdownBlocks("const x = 5;", undefined),
      ).toBe(false);
    });

    it("should handle complex first line scenarios", () => {
      expect(
        lineStream.hasNestedMarkdownBlocks("```markdown README.md", undefined),
      ).toBe(true);
      expect(
        lineStream.hasNestedMarkdownBlocks("```md with extra text", undefined),
      ).toBe(true);
    });
  });

  describe("collectAllLines", () => {
    it("should collect all lines from a stream", async () => {
      const linesGenerator = await getLineGenerator([
        "line1",
        "line2",
        "line3",
      ]);

      const result = await collectAllLines(linesGenerator);

      expect(result).toEqual(["line1", "line2", "line3"]);
    });

    it("should handle empty stream", async () => {
      const linesGenerator = await getLineGenerator([]);

      const result = await collectAllLines(linesGenerator);

      expect(result).toEqual([]);
    });

    it("should handle stream with empty lines", async () => {
      const linesGenerator = await getLineGenerator(["", "line2", "", "line4"]);

      const result = await collectAllLines(linesGenerator);

      expect(result).toEqual(["", "line2", "", "line4"]);
    });
  });

  describe("shouldStopAtMarkdownBlock", () => {
    it("should return false when current line is not closing backticks", () => {
      const allLines = ["```markdown", "content", "more content"];
      const state = new MarkdownBlockStateTracker(allLines);
      expect(shouldStopAtMarkdownBlock(state, 2)).toBe(false);
    });

    it("should handle simple nested markdown case", () => {
      const allLines = ["```markdown", "# Title", "```"];
      const state = new MarkdownBlockStateTracker(allLines);
      expect(shouldStopAtMarkdownBlock(state, 2)).toBe(true);
    });

    it("should handle complex nested markdown with inner code blocks", () => {
      const allLines = [
        "```markdown",
        "# Title",
        "```javascript",
        "console.log('hello');",
        "```",
        "```",
      ];
      const state = new MarkdownBlockStateTracker(allLines);
      // At index 4 (first inner closing), should not stop
      expect(shouldStopAtMarkdownBlock(state, 4)).toBe(false);
      // At index 5 (outer closing), should stop
      expect(shouldStopAtMarkdownBlock(state, 5)).toBe(true);
    });

    it("should handle multiple bare backticks scenario", () => {
      const allLines = [
        "```markdown",
        "Content with ```inline code```",
        "```",
        "More content",
        "```",
      ];
      const state = new MarkdownBlockStateTracker(allLines);
      // At index 2, should not stop (not the last bare backticks)
      expect(shouldStopAtMarkdownBlock(state, 2)).toBe(false);
      // At index 4, should stop (last bare backticks)
      expect(shouldStopAtMarkdownBlock(state, 4)).toBe(true);
    });
  });

  describe("shouldChangeLineAndStop", () => {
    it("should handle [/CODE] at start of line", () => {
      const result = lineStream.shouldChangeLineAndStop("[/CODE]");
      expect(result).toBe("[/CODE]");
    });

    it("should handle [/CODE] with leading whitespace", () => {
      const result = lineStream.shouldChangeLineAndStop("    [/CODE]");
      expect(result).toBe("    [/CODE]");
    });

    it("should return partial line before [/CODE] when at start/after whitespace", () => {
      const result = lineStream.shouldChangeLineAndStop(
        "some code [/CODE] more text",
      );
      expect(result).toBe("some code");
    });

    it("should NOT trigger on [/CODE] within quotes or non-whitespace preceded", () => {
      // This test demonstrates the current bug - it WILL fail initially
      const result = lineStream.shouldChangeLineAndStop(
        'console.log("test [/CODE] end");',
      );
      expect(result).toBeUndefined(); // Should not trigger stopping
    });

    it("should NOT trigger on [/CODE] in middle of identifier", () => {
      // Another case that shows the bug
      const result = lineStream.shouldChangeLineAndStop(
        'const var[/CODE]Name = "test";',
      );
      expect(result).toBeUndefined(); // Should not trigger stopping
    });

    it("should handle ``` with trimStart correctly", () => {
      const result = lineStream.shouldChangeLineAndStop("    ```");
      expect(result).toBe("    ```");
    });

    it("should NOT handle ``` in middle of line", () => {
      const result = lineStream.shouldChangeLineAndStop(
        'console.log("test ``` end");',
      );
      expect(result).toBeUndefined();
    });
  });

  describe("MarkdownBlockState", () => {
    it("should initialize with correct state", () => {
      const allLines = ["```markdown", "content", "```", "more content", "```"];
      const state = new MarkdownBlockStateTracker(allLines);

      // Test basic initialization - we can't directly test private properties,
      // but we can test the behavior through shouldStopAtPosition
      expect(state).toBeDefined();
    });

    it("should correctly identify bare backticks positions", () => {
      const allLines = ["```markdown", "```", "content", "```"];
      const state = new MarkdownBlockStateTracker(allLines);

      // At position 1 (first bare backticks), should not stop
      expect(state.shouldStopAtPosition(1)).toBe(false);
      // At position 3 (last bare backticks), should stop
      expect(state.shouldStopAtPosition(3)).toBe(true);
    });

    it("should maintain state across multiple calls", () => {
      const allLines = [
        "```markdown",
        "# Title",
        "```javascript",
        "console.log('test');",
        "```",
        "More content",
        "```",
      ];
      const state = new MarkdownBlockStateTracker(allLines);

      // Process positions incrementally
      expect(state.shouldStopAtPosition(2)).toBe(false); // Start of inner block
      expect(state.shouldStopAtPosition(4)).toBe(false); // End of inner block
      expect(state.shouldStopAtPosition(6)).toBe(true); // End of outer block
    });

    it("should handle complex nesting scenarios efficiently", () => {
      const allLines = [
        "```markdown",
        "# Documentation",
        "```typescript",
        "interface Config {",
        "  name: string;",
        "}",
        "```",
        "",
        "```bash",
        "npm install",
        "```",
        "",
        "Final notes",
        "```",
      ];
      const state = new MarkdownBlockStateTracker(allLines);

      // Test multiple positions in sequence
      expect(state.shouldStopAtPosition(6)).toBe(false); // End of first inner block
      expect(state.shouldStopAtPosition(10)).toBe(false); // End of second inner block
      expect(state.shouldStopAtPosition(13)).toBe(true); // End of outer markdown block
    });

    it("should handle non-backtick lines correctly", () => {
      const allLines = ["```markdown", "regular content", "```"];
      const state = new MarkdownBlockStateTracker(allLines);

      // Position 1 is not backticks, should return false
      expect(state.shouldStopAtPosition(1)).toBe(false);
    });

    it("should handle empty lines and edge cases", () => {
      const allLines = ["```markdown", "", "```"];
      const state = new MarkdownBlockStateTracker(allLines);

      expect(state.shouldStopAtPosition(1)).toBe(false); // Empty line
      expect(state.shouldStopAtPosition(2)).toBe(true); // Closing backticks
    });

    it("should reset nest count when reaching final bare backticks", () => {
      const allLines = ["```markdown", "content", "```"];
      const state = new MarkdownBlockStateTracker(allLines);

      // First call should stop and reset count
      expect(state.shouldStopAtPosition(2)).toBe(true);

      // If we had more content, it should start fresh
      // (This tests the internal state management)
    });
  });

  describe("shouldStopAtMarkdownBlock optimization", () => {
    it("should maintain performance benefits with state reuse", () => {
      const allLines = Array.from({ length: 100 }, (_, i) => {
        if (i === 0) return "```markdown";
        if (i === 99) return "```";
        if (i % 10 === 0) return "```javascript";
        if (i % 10 === 5) return "```";
        return `line ${i}`;
      });

      const state = new MarkdownBlockStateTracker(allLines);

      // Test that we can call multiple times without recomputing everything
      const start = performance.now();

      // Test several positions in sequence
      for (let i = 10; i < 90; i += 10) {
        if (allLines[i].trim() === "```") {
          shouldStopAtMarkdownBlock(state, i);
        }
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10); // Should be very fast due to state caching
    });
  });

  describe("filterCodeBlockLines with optimized MarkdownBlockState", () => {
    it("should use optimized state tracker for markdown files", async () => {
      const linesGenerator = await getLineGenerator([
        "```markdown",
        "# Documentation",
        "```typescript",
        "const config = { name: 'test' };",
        "```",
        "Final notes",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(
        linesGenerator,
        "README.md",
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "# Documentation",
        "```typescript",
        "const config = { name: 'test' };",
        "```",
        "Final notes",
      ]);
    });

    it("should fall back to legacy behavior when no markdown nesting detected", async () => {
      const linesGenerator = await getLineGenerator([
        "```typescript",
        "const x = 5;",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(
        linesGenerator,
        "script.ts",
      );
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual(["const x = 5;"]);
    });

    it("should handle mixed markdown and code scenarios with optimization", async () => {
      const linesGenerator = await getLineGenerator([
        "```md",
        "## API Reference",
        "",
        "```javascript",
        "async function fetchData() {",
        "  return await fetch('/api/data');",
        "}",
        "```",
        "",
        "Usage notes and more documentation.",
        "```",
      ]);

      const result = lineStream.filterCodeBlockLines(linesGenerator);
      const filteredLines = await getFilteredLines(result);

      expect(filteredLines).toEqual([
        "## API Reference",
        "",
        "```javascript",
        "async function fetchData() {",
        "  return await fetch('/api/data');",
        "}",
        "```",
        "",
        "Usage notes and more documentation.",
      ]);
    });
  });

  describe("validatePatternInLine", () => {
    it("should return false when pattern is not found", () => {
      const result = lineStream.validatePatternInLine(
        "const x = 5;",
        "[/CODE]",
      );
      expect(result.isValid).toBe(false);
      expect(result.patternIndex).toBe(-1);
      expect(result.beforePattern).toBe("");
    });

    it("should return false when pattern is preceded by non-whitespace", () => {
      const result = lineStream.validatePatternInLine(
        'const var[/CODE]Name = "test";',
        "[/CODE]",
      );
      expect(result.isValid).toBe(false);
      expect(result.patternIndex).toBe(9);
    });

    it("should return false when pattern is inside double quotes", () => {
      const result = lineStream.validatePatternInLine(
        'console.log("test [/CODE] end");',
        "[/CODE]",
      );
      expect(result.isValid).toBe(false);
      expect(result.patternIndex).toBe(18);
    });

    it("should return false when pattern is inside single quotes", () => {
      const result = lineStream.validatePatternInLine(
        "const message = 'test [/CODE] end';",
        "[/CODE]",
      );
      expect(result.isValid).toBe(false);
      expect(result.patternIndex).toBe(22);
    });

    it("should return true when pattern is properly separated by whitespace", () => {
      const result = lineStream.validatePatternInLine(
        "some code [/CODE] more text",
        "[/CODE]",
      );
      expect(result.isValid).toBe(true);
      expect(result.patternIndex).toBe(10);
      expect(result.beforePattern).toBe("some code ");
    });

    it("should return true when pattern is at start of line", () => {
      const result = lineStream.validatePatternInLine("[/CODE]", "[/CODE]");
      expect(result.isValid).toBe(true);
      expect(result.patternIndex).toBe(0);
      expect(result.beforePattern).toBe("");
    });

    it("should return true when pattern has only whitespace before it", () => {
      const result = lineStream.validatePatternInLine("    [/CODE]", "[/CODE]");
      expect(result.isValid).toBe(true);
      expect(result.patternIndex).toBe(4);
      expect(result.beforePattern).toBe("    ");
    });

    it("should handle complex quote scenarios correctly", () => {
      // Unmatched quote should make it invalid
      const result1 = lineStream.validatePatternInLine(
        'const x = "unclosed quote [/CODE]',
        "[/CODE]",
      );
      expect(result1.isValid).toBe(false);

      // Matched quotes should make it valid
      const result2 = lineStream.validatePatternInLine(
        'const x = "closed"; [/CODE]',
        "[/CODE]",
      );
      expect(result2.isValid).toBe(true);
    });

    it("should work with different patterns", () => {
      const result1 = lineStream.validatePatternInLine(
        "# End of file. Done",
        "# End of file.",
      );
      expect(result1.isValid).toBe(true);

      const result2 = lineStream.validatePatternInLine("    ```", "```");
      expect(result2.isValid).toBe(true);
    });
  });
});
