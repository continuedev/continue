import { expect, test } from "vitest";
import { LineStream } from "../diff/util";
import {
  processBlockNesting,
  stopAtLinesWithMarkdownSupport,
} from "./streamMarkdownUtils";

test("processBlockNesting correctly handles starting blocks", () => {
  // Mock function to determine which lines should be removed
  const shouldRemoveLineBeforeStart = (line: string) =>
    line === "[CODE]" || line === "```";

  // Test not seeing first fence yet
  const result1 = processBlockNesting(
    "[CODE]",
    false,
    shouldRemoveLineBeforeStart,
  );
  expect(result1.newSeenFirstFence).toBe(false);
  expect(result1.shouldSkip).toBe(true);

  // Test not seeing first fence but line shouldn't be removed
  const result2 = processBlockNesting(
    "normal code",
    false,
    shouldRemoveLineBeforeStart,
  );
  expect(result2.newSeenFirstFence).toBe(true);
  expect(result2.shouldSkip).toBe(false);

  // Test already seen first fence
  const result3 = processBlockNesting(
    "more code",
    true,
    shouldRemoveLineBeforeStart,
  );
  expect(result3.newSeenFirstFence).toBe(true);
  expect(result3.shouldSkip).toBe(false);
});

test("stopAtLinesWithMarkdownSupport handles non-markdown files", async () => {
  // Create a mock line stream
  const mockLines = ["line 1", "line 2", "```", "line 4"];
  const lineStream: LineStream = (async function* () {
    for (const line of mockLines) {
      yield line;
    }
  })();

  // Test with a non-markdown file
  const filename = "test.js";
  const result = stopAtLinesWithMarkdownSupport(lineStream, filename);

  // Should only yield lines up to the backticks
  const collected = [];
  for await (const line of result) {
    collected.push(line);
  }

  expect(collected).toEqual(["line 1", "line 2"]);
});

test("stopAtLinesWithMarkdownSupport handles markdown files with no nested blocks", async () => {
  // Create a mock line stream with markdown content - but NOT nested markdown blocks
  const mockLines = [
    "Some markdown text",
    "",
    "```javascript",
    "function test() {",
    "  return true;",
    "}",
    "```",
    "More text",
  ];

  const lineStream: LineStream = (async function* () {
    for (const line of mockLines) {
      yield line;
    }
  })();

  // Test with a markdown file
  const filename = "test.md";
  const result = stopAtLinesWithMarkdownSupport(lineStream, filename);

  // Should yield everything since there's no outer closing fence
  const collected = [];
  for await (const line of result) {
    collected.push(line);
  }

  // With the new depth-counting algorithm, we only stop at the outer closing fence
  // Since there's no outer fence here, we yield everything
  expect(collected).toEqual([
    "Some markdown text",
    "",
    "```javascript",
    "function test() {",
    "  return true;",
    "}",
    "```",
    "More text",
  ]);
});

async function* toLineStream(lines: string[]): LineStream {
  for (const line of lines) {
    yield line;
  }
}

test("stopAtLinesWithMarkdownSupport: markdown file with single plain fenced block yields all content", async () => {
  const mockLines = [
    "# Title",
    "Some example:",
    "```javascript",
    "const x = 1;",
    "```",
    "More content.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "README.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Should include everything up to (but not including) the final outer ```
  expect(collected).toEqual([
    "# Title",
    "Some example:",
    "```javascript",
    "const x = 1;",
    "```",
    "More content.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: markdown file with two sequential fenced blocks yields all content", async () => {
  const mockLines = [
    "# Docs",
    "```bash",
    "npm install",
    "```",
    "Then:",
    "```python",
    "print('hello')",
    "```",
    "Done.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "docs.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  expect(collected).toEqual([
    "# Docs",
    "```bash",
    "npm install",
    "```",
    "Then:",
    "```python",
    "print('hello')",
    "```",
    "Done.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: markdown file with nested markdown fence still works", async () => {
  const mockLines = [
    "# Nested Example",
    "```markdown",
    "# Inner",
    "```javascript",
    "code();",
    "```",
    "End inner",
    "```",
    "After nested.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "README.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Should include all content up to but not including the final outer closing fence
  expect(collected).toEqual([
    "# Nested Example",
    "```markdown",
    "# Inner",
    "```javascript",
    "code();",
    "```",
    "End inner",
    "```",
    "After nested.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: markdown file with no fenced blocks yields all lines", async () => {
  const mockLines = ["# Title", "Plain text only.", "No fences here."];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "README.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  expect(collected).toEqual(["# Title", "Plain text only.", "No fences here."]);
});

test("stopAtLinesWithMarkdownSupport: non-markdown file still stops at first bare backticks (regression guard)", async () => {
  const mockLines = ["line 1", "line 2", "```", "line 4"];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "script.js",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  expect(collected).toEqual(["line 1", "line 2"]);
});

test("stopAtLinesWithMarkdownSupport: four-backtick block with inner triple-backtick content", async () => {
  // Test case (a): markdown file with a four-backtick opening and closing fence
  // The four-backtick outer fence contains triple-backtick content inside
  const mockLines = [
    "# Document",
    "````markdown",
    "# Inner markdown",
    "```javascript",
    "const x = 1;",
    "```",
    "End of inner",
    "````",
    "After block.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "example.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Should stop at the final outer closing fence (triple backticks)
  // and NOT include it in the output
  expect(collected).toEqual([
    "# Document",
    "````markdown",
    "# Inner markdown",
    "```javascript",
    "const x = 1;",
    "```",
    "End of inner",
    "````",
    "After block.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: unclosed inner fence with outer closing fence", async () => {
  // Test case (b): unclosed inner markdown fence followed by the outer closing fence
  // This should prefer treating the final fence as the outer closer
  const mockLines = [
    "# Document",
    "```markdown",
    "# Inner title",
    "```javascript",
    "const x = 1;",
    "// Missing close fence for the inner block",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "README.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Should NOT include the outer closing fence in output
  // The outer ``` should not appear in the applied file
  expect(collected).toEqual([
    "# Document",
    "```markdown",
    "# Inner title",
    "```javascript",
    "const x = 1;",
    "// Missing close fence for the inner block",
  ]);
});

test("stopAtLinesWithMarkdownSupport: multi-backtick fence properly closes only with >= backticks", async () => {
  // Additional test to ensure backtick count validation works
  // When a block opens with 4 backticks, only 4 or more backticks on a bare line close it
  const mockLines = [
    "Example:",
    "````markdown",
    "Content inside 4-backtick fence",
    "```",
    "Still inside (3 < 4)",
    "````",
    "After outer close.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "test.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Stop at the final ``` (outer closing fence at depth 0)
  expect(collected).toEqual([
    "Example:",
    "````markdown",
    "Content inside 4-backtick fence",
    "```",
    "Still inside (3 < 4)",
    "````",
    "After outer close.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: info-string fence inside an open inner block is content, not a new opener", async () => {
  // Per CommonMark, fences do not nest: inside an open inner block, a line like
  // "```bash" is code content. It must not push depth and consume the real closer.
  const mockLines = [
    "# Doc",
    "```markdown",
    "Example of a fence inside a fence:",
    "```bash",
    "echo hi",
    "```",
    "After inner close.",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "README.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // The "```bash" line is content of the markdown block; the first bare ``` closes it,
  // "After inner close." is body text, and the final bare ``` is the outer closer.
  expect(collected).toEqual([
    "# Doc",
    "```markdown",
    "Example of a fence inside a fence:",
    "```bash",
    "echo hi",
    "```",
    "After inner close.",
  ]);
});

test("stopAtLinesWithMarkdownSupport: short or over-indented backtick lines are not fences", async () => {
  // CommonMark requires 3+ fence chars and at most 3 spaces of indentation.
  const mockLines = [
    "Some text",
    "``not a fence``",
    "      ```",
    "still content (over-indented fence is code)",
    "```",
  ];
  const result = stopAtLinesWithMarkdownSupport(
    toLineStream(mockLines),
    "notes.md",
  );
  const collected: string[] = [];
  for await (const line of result) {
    collected.push(line);
  }
  // Only the final flush-left bare ``` is the outer closer.
  expect(collected).toEqual([
    "Some text",
    "``not a fence``",
    "      ```",
    "still content (over-indented fence is code)",
  ]);
});
