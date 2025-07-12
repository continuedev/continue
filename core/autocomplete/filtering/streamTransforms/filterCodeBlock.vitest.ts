// eslint-disable-next-line max-lines-per-function
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

import * as lineStream from "./lineStream";

describe("filterCodeBlock", () => {
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

    expect(filteredLines).toEqual(["const x = 5;", "```bash", "ls -al", "```"]);
  });

  it("should handle unfenced code with a complex code block", async () => {
    const linesGenerator = await getLineGenerator([
      "# Manual Testing Sandbox",
      "",
      "## Project Structure",
      "",
      "```",
      "manual-testing-sandbox/",
      "├── readme.md                           # Project documentation",
      "├── package.json                        # Node.js dependencies and scripts",
      "├── tsconfig.json                       # TypeScript configuration",
      "├── jest.config.js                      # Jest testing configuration",
      "├── requirements.txt                    # Python dependencies",
      "├── Dockerfile                          # Docker container configuration",
      "├── data.json                           # Sample JSON data",
      "├── example.ipynb                       # Jupyter notebook example",
      "│",
      "├── src/                                # Source code directory",
      "│   ├── example.ts                      # TypeScript example",
      "│   ├── JsonToMarkdownConverter.ts      # JSON to Markdown converter",
      "│   ├── JsonToMarkdownConverter.test.ts # Tests for JSON converter",
      "│   ├── MarkdownProcessor.ts            # Markdown processing utility",
      "│   └── MarkdownProcessor.test.ts       # Tests for Markdown processor",
      "│",
      "├── react-calculator/                   # React calculator application",
      "├── calculator_test/                    # Java calculator implementation",
      "│   ├── Calculator.java                 # Calculator class",
      "│   └── Main.java                       # Main application entry",
      "│",
      "├── nested-folder/                      # Nested project example",
      "│   ├── helloNested.py                  # Python script",
      "│   ├── package.json                    # Nested package configuration",
      "│   └── rules.md                        # Documentation",
      "│",
      "├── coverage/                           # Test coverage reports",
      "├── logs/                               # Application logs",
      "│",
      "└── Test Files                          # Various language examples",
      "    ├── AdvancedPage.tsx                # React TypeScript component",
      "    ├── Calculator.java                 # Java calculator",
      "    ├── program.cs                      # C# program",
      "    ├── query.sql                       # SQL query example",
      "    ├── test.css                        # CSS styles",
      "    ├── test.html                       # HTML page",
      "    ├── test.js                         # JavaScript code",
      "    ├── test.kt                         # Kotlin example",
      "    ├── test.php                        # PHP script",
      "    ├── test.py                         # Python script",
      "    ├── test.rb                         # Ruby script",
      "    ├── test.rs                         # Rust code",
      "    ├── test.sh                         # Shell script",
      "    └── test.ts                         # TypeScript code",
      "```",
    ]);

    const result = lineStream.filterCodeBlockLines(linesGenerator);
    const filteredLines = await getFilteredLines(result);

    expect(filteredLines).toEqual([
      "# Manual Testing Sandbox",
      "",
      "## Project Structure",
      "",
      "```",
      "manual-testing-sandbox/",
      "├── readme.md                           # Project documentation",
      "├── package.json                        # Node.js dependencies and scripts",
      "├── tsconfig.json                       # TypeScript configuration",
      "├── jest.config.js                      # Jest testing configuration",
      "├── requirements.txt                    # Python dependencies",
      "├── Dockerfile                          # Docker container configuration",
      "├── data.json                           # Sample JSON data",
      "├── example.ipynb                       # Jupyter notebook example",
      "│",
      "├── src/                                # Source code directory",
      "│   ├── example.ts                      # TypeScript example",
      "│   ├── JsonToMarkdownConverter.ts      # JSON to Markdown converter",
      "│   ├── JsonToMarkdownConverter.test.ts # Tests for JSON converter",
      "│   ├── MarkdownProcessor.ts            # Markdown processing utility",
      "│   └── MarkdownProcessor.test.ts       # Tests for Markdown processor",
      "│",
      "├── react-calculator/                   # React calculator application",
      "├── calculator_test/                    # Java calculator implementation",
      "│   ├── Calculator.java                 # Calculator class",
      "│   └── Main.java                       # Main application entry",
      "│",
      "├── nested-folder/                      # Nested project example",
      "│   ├── helloNested.py                  # Python script",
      "│   ├── package.json                    # Nested package configuration",
      "│   └── rules.md                        # Documentation",
      "│",
      "├── coverage/                           # Test coverage reports",
      "├── logs/                               # Application logs",
      "│",
      "└── Test Files                          # Various language examples",
      "    ├── AdvancedPage.tsx                # React TypeScript component",
      "    ├── Calculator.java                 # Java calculator",
      "    ├── program.cs                      # C# program",
      "    ├── query.sql                       # SQL query example",
      "    ├── test.css                        # CSS styles",
      "    ├── test.html                       # HTML page",
      "    ├── test.js                         # JavaScript code",
      "    ├── test.kt                         # Kotlin example",
      "    ├── test.php                        # PHP script",
      "    ├── test.py                         # Python script",
      "    ├── test.rb                         # Ruby script",
      "    ├── test.rs                         # Rust code",
      "    ├── test.sh                         # Shell script",
      "    └── test.ts                         # TypeScript code",
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

    expect(filteredLines).toEqual(["const x = 5;", "```bash", "ls -al", "```"]);
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

    expect(filteredLines).toEqual(["const x = 5;", "```bash", "ls -al", "```"]);
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

    expect(filteredLines).toEqual(["const x = 5;", "```bash", "ls -al", "```"]);
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

    const result = lineStream.filterCodeBlockLines(linesGenerator, "README.md");
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

    const result = lineStream.filterCodeBlockLines(linesGenerator, "README.md");
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
