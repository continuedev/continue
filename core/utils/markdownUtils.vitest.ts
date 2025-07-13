import { describe, expect, it } from "vitest";
import {
  collectAllLines,
  headerIsMarkdown,
  isMarkdownFile,
  MarkdownBlockStateTracker,
} from "./markdownUtils";

describe("headerIsMarkdown", () => {
  // Test exact match with common Markdown identifiers
  it("should identify exact matches with common Markdown identifiers", () => {
    expect(headerIsMarkdown("md")).toBe(true);
    expect(headerIsMarkdown("markdown")).toBe(true);
    expect(headerIsMarkdown("gfm")).toBe(true);
    expect(headerIsMarkdown("github-markdown")).toBe(true);
  });

  // Test identifiers preceded by a space
  it("should identify identifiers preceded by a space", () => {
    expect(headerIsMarkdown("lang md")).toBe(true);
    expect(headerIsMarkdown("something markdown")).toBe(true);
    expect(headerIsMarkdown("language gfm")).toBe(true);
    expect(headerIsMarkdown("spec github-markdown")).toBe(true);
  });

  // Test file extensions
  it("should identify file names with markdown extensions", () => {
    expect(headerIsMarkdown("example.md")).toBe(true);
    expect(headerIsMarkdown("document.markdown")).toBe(true);
    expect(headerIsMarkdown("readme.gfm")).toBe(true);
  });

  // Test more complex cases with extensions
  it("should identify file names with markdown extensions followed by other text", () => {
    expect(headerIsMarkdown("example.md additional text")).toBe(true);
    expect(headerIsMarkdown("document.markdown with some description")).toBe(
      true,
    );
    expect(headerIsMarkdown("readme.gfm v2.0")).toBe(true);
  });

  // Test non-markdown cases
  it("should not identify non-markdown headers", () => {
    expect(headerIsMarkdown("javascript")).toBe(false);
    expect(headerIsMarkdown("typescript")).toBe(false);
    expect(headerIsMarkdown("plain")).toBe(false);
    expect(headerIsMarkdown("python")).toBe(false);
  });

  // Test edge cases
  it("should handle edge cases correctly", () => {
    expect(headerIsMarkdown("")).toBe(false);
    expect(headerIsMarkdown("mdx")).toBe(false); // Similar but not exactly "md"
    expect(headerIsMarkdown("readme md")).toBe(true);
    expect(headerIsMarkdown("md.js")).toBe(false); // "md" is not the extension
  });

  // Test case sensitivity
  it("should respect case sensitivity", () => {
    expect(headerIsMarkdown("MD")).toBe(false);
    expect(headerIsMarkdown("MARKDOWN")).toBe(false);
    expect(headerIsMarkdown("example.MD")).toBe(false);
    expect(headerIsMarkdown("lang MD")).toBe(false);
  });

  // Test with special characters and spacing
  it("should handle special characters and spacing correctly", () => {
    expect(headerIsMarkdown("  md")).toBe(true); // Space before "md"
    expect(headerIsMarkdown("md  ")).toBe(true); // Space after "md"
    expect(headerIsMarkdown("hello-md")).toBe(false); // "md" with hyphen prefix
    expect(headerIsMarkdown("markdown:")).toBe(false); // "markdown" with suffix
  });
});

describe("isMarkdownFile", () => {
  it("should identify markdown files by .md extension", () => {
    expect(isMarkdownFile("README.md")).toBe(true);
    expect(isMarkdownFile("docs/guide.md")).toBe(true);
    expect(isMarkdownFile("/path/to/file.md")).toBe(true);
  });

  it("should identify markdown files by .markdown extension", () => {
    expect(isMarkdownFile("README.markdown")).toBe(true);
    expect(isMarkdownFile("docs/guide.markdown")).toBe(true);
    expect(isMarkdownFile("/path/to/file.markdown")).toBe(true);
  });

  it("should identify markdown files by .gfm extension", () => {
    expect(isMarkdownFile("README.gfm")).toBe(true);
    expect(isMarkdownFile("docs/guide.gfm")).toBe(true);
    expect(isMarkdownFile("/path/to/file.gfm")).toBe(true);
  });

  it("should handle case insensitive extensions", () => {
    expect(isMarkdownFile("README.MD")).toBe(true);
    expect(isMarkdownFile("guide.MARKDOWN")).toBe(true);
    expect(isMarkdownFile("file.GFM")).toBe(true);
  });

  it("should return false for non-markdown files", () => {
    expect(isMarkdownFile("script.js")).toBe(false);
    expect(isMarkdownFile("style.css")).toBe(false);
    expect(isMarkdownFile("data.json")).toBe(false);
    expect(isMarkdownFile("document.txt")).toBe(false);
  });

  it("should return false for undefined or empty filepath", () => {
    expect(isMarkdownFile(undefined)).toBe(false);
    expect(isMarkdownFile("")).toBe(false);
  });

  it("should return false for files without extensions", () => {
    expect(isMarkdownFile("README")).toBe(false);
    expect(isMarkdownFile("Dockerfile")).toBe(false);
  });

  it("should handle files with multiple dots", () => {
    expect(isMarkdownFile("file.backup.md")).toBe(true);
    expect(isMarkdownFile("config.test.js")).toBe(false);
  });
});

describe("MarkdownBlockStateTracker", () => {
  it("should initialize correctly with empty lines", () => {
    const tracker = new MarkdownBlockStateTracker([]);
    expect(tracker.shouldStopAtPosition(0)).toBe(false);
  });

  it("should initialize correctly with non-markdown lines", () => {
    const tracker = new MarkdownBlockStateTracker([
      "const x = 5;",
      "console.log(x);",
    ]);
    expect(tracker.shouldStopAtPosition(0)).toBe(false);
    expect(tracker.shouldStopAtPosition(1)).toBe(false);
  });

  it("should detect simple markdown blocks", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "# Title",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(0)).toBe(false); // Opening
    expect(tracker.shouldStopAtPosition(1)).toBe(false); // Content
    expect(tracker.shouldStopAtPosition(2)).toBe(true); // Closing
  });

  it("should handle nested code blocks within markdown", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```md",
      "Here's some code:",
      "```javascript",
      "console.log('hello');",
      "```",
      "More content",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(2)).toBe(false); // Inner opening
    expect(tracker.shouldStopAtPosition(4)).toBe(false); // Inner closing
    expect(tracker.shouldStopAtPosition(6)).toBe(true); // Outer closing
  });

  it("should handle multiple bare backticks", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "Content with ```inline``` code",
      "```",
      "More content",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(2)).toBe(false); // First bare backticks
    expect(tracker.shouldStopAtPosition(4)).toBe(true); // Last bare backticks
  });

  it("should handle non-markdown code blocks", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```javascript",
      "console.log('hello');",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(2)).toBe(false); // Not a markdown block
  });

  it("should handle mixed markdown types", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```gfm",
      "# GitHub Flavored Markdown",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(2)).toBe(true);
  });

  it("should handle state persistence across multiple calls", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "# Documentation",
      "```typescript",
      "interface Config {}",
      "```",
      "Final notes",
      "```",
    ]);

    // Process incrementally
    expect(tracker.shouldStopAtPosition(2)).toBe(false); // Inner opening
    expect(tracker.shouldStopAtPosition(4)).toBe(false); // Inner closing
    expect(tracker.shouldStopAtPosition(6)).toBe(true); // Outer closing
  });

  it("should handle lines that are not closing backticks", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "Regular content line",
      "```",
    ]);
    expect(tracker.shouldStopAtPosition(1)).toBe(false); // Not backticks
  });

  it("should provide access to trimmed lines", () => {
    const tracker = new MarkdownBlockStateTracker([
      "  ```markdown  ",
      "  # Title  ",
      "  ```  ",
    ]);
    const trimmedLines = tracker.getTrimmedLines();
    expect(trimmedLines).toEqual(["```markdown", "# Title", "```"]);
  });

  it("should identify bare backtick lines correctly", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "```",
      "content",
      "```",
    ]);
    expect(tracker.isBareBacktickLine(0)).toBe(false); // Has language
    expect(tracker.isBareBacktickLine(1)).toBe(true); // Bare backticks
    expect(tracker.isBareBacktickLine(2)).toBe(false); // Content
    expect(tracker.isBareBacktickLine(3)).toBe(true); // Bare backticks
  });

  it("should count remaining bare backticks correctly", () => {
    const tracker = new MarkdownBlockStateTracker([
      "```markdown",
      "```",
      "content",
      "```",
      "more content",
      "```",
    ]);
    expect(tracker.getRemainingBareBackticksAfter(0)).toBe(3); // After opening
    expect(tracker.getRemainingBareBackticksAfter(1)).toBe(2); // After first bare
    expect(tracker.getRemainingBareBackticksAfter(3)).toBe(1); // After second bare
    expect(tracker.getRemainingBareBackticksAfter(5)).toBe(0); // After last bare
  });
});

describe("collectAllLines", () => {
  async function* createAsyncGenerator<T>(items: T[]): AsyncGenerator<T> {
    for (const item of items) {
      yield item;
    }
  }

  it("should collect all lines from a stream", async () => {
    const stream = createAsyncGenerator(["line1", "line2", "line3"]);
    const result = await collectAllLines(stream);
    expect(result).toEqual(["line1", "line2", "line3"]);
  });

  it("should handle empty streams", async () => {
    const stream = createAsyncGenerator([]);
    const result = await collectAllLines(stream);
    expect(result).toEqual([]);
  });

  it("should handle streams with mixed types", async () => {
    const stream = createAsyncGenerator([1, "text", null, true]);
    const result = await collectAllLines(stream);
    expect(result).toEqual([1, "text", null, true]);
  });

  it("should handle streams with empty strings", async () => {
    const stream = createAsyncGenerator(["", "line2", "", "line4"]);
    const result = await collectAllLines(stream);
    expect(result).toEqual(["", "line2", "", "line4"]);
  });

  it("should handle large streams", async () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => `line${i}`);
    const stream = createAsyncGenerator(largeArray);
    const result = await collectAllLines(stream);
    expect(result).toEqual(largeArray);
  });

  it("should handle object streams", async () => {
    const objects = [
      { type: "new", line: "const x = 5;" },
      { type: "old", line: "let y = 10;" },
    ];
    const stream = createAsyncGenerator(objects);
    const result = await collectAllLines(stream);
    expect(result).toEqual(objects);
  });
});
