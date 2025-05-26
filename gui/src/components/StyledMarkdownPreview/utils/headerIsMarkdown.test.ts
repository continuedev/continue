import { headerIsMarkdown } from "./headerIsMarkdown";

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
