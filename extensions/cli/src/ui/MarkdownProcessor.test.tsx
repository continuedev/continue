import { render } from "ink-testing-library";
import React from "react";

import {
  processMarkdownToSegments,
  splitStyledSegmentsIntoRows,
  StyledSegment,
  StyledSegmentRenderer,
} from "./MarkdownProcessor.js";

describe("MarkdownProcessor", () => {
  describe("processMarkdownToSegments", () => {
    it("processes basic markdown formatting", () => {
      const text = "This is **bold** and *italic* text.";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(5);
      expect(segments[0]).toEqual({
        text: "This is ",
        styling: { type: "text" },
      });
      expect(segments[1]).toEqual({
        text: "bold",
        styling: { bold: true },
      });
      expect(segments[2]).toEqual({
        text: " and ",
        styling: { type: "text" },
      });
      expect(segments[3]).toEqual({
        text: "italic",
        styling: { italic: true },
      });
      expect(segments[4]).toEqual({
        text: " text.",
        styling: { type: "text" },
      });
    });

    it("processes headings", () => {
      const text = "# Main Title\n## Subtitle";
      const segments = processMarkdownToSegments(text);

      expect(segments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: "Main Title",
            styling: { bold: true, type: "heading" },
          }),
          expect.objectContaining({
            text: "Subtitle",
            styling: { bold: true, type: "heading" },
          }),
        ]),
      );
    });

    it("processes code blocks with language", () => {
      const text = "```javascript\nconsole.log('hello');\n```";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        text: "console.log('hello');",
        styling: { type: "codeblock", language: "javascript" },
      });
    });

    it("processes inline code", () => {
      const text = "Use the `console.log()` function.";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(3);
      expect(segments[1]).toEqual({
        text: "console.log()",
        styling: { color: "magentaBright", type: "code" },
      });
    });

    it("processes thinking tags", () => {
      const text = "<think>Let me consider this</think>";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        text: "Let me consider this",
        styling: { color: "gray", type: "think" },
      });
    });

    it("handles strikethrough", () => {
      const text = "This is ~~deleted~~ text.";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(3);
      expect(segments[1]).toEqual({
        text: "deleted",
        styling: { strikethrough: true },
      });
    });

    it("handles empty or null input", () => {
      expect(processMarkdownToSegments("")).toEqual([]);
      expect(processMarkdownToSegments(null)).toEqual([]);
      expect(processMarkdownToSegments(undefined)).toEqual([]);
    });

    it("preserves text inside code blocks from markdown processing", () => {
      const text = "```\nThis **should not** be bold\n```";
      const segments = processMarkdownToSegments(text);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        text: "This **should not** be bold",
        styling: { type: "codeblock", language: "javascript" }, // detectLanguage may return 'javascript' for this content
      });
    });

    it("handles mixed formatting", () => {
      const text = "**Bold _and italic_** text.";
      const segments = processMarkdownToSegments(text);

      // Should find the bold pattern first and not process italic inside it
      expect(segments).toEqual([
        {
          text: "Bold _and italic_",
          styling: { bold: true },
        },
        {
          text: " text.",
          styling: { type: "text" },
        },
      ]);
    });
  });

  describe("splitStyledSegmentsIntoRows", () => {
    it("splits long text into multiple rows", () => {
      const segments: StyledSegment[] = [
        {
          text: "This is a very long line that should be split into multiple rows when it exceeds the terminal width",
          styling: { type: "text" },
        },
      ];

      const rows = splitStyledSegmentsIntoRows(segments, 30);

      expect(rows.length).toBeGreaterThan(1);
      // Each row should fit within the available width (30 - 6 = 24 characters)
      rows.forEach((row) => {
        const totalLength = row.reduce(
          (sum, segment) => sum + segment.text.length,
          0,
        );
        expect(totalLength).toBeLessThanOrEqual(24);
      });
    });

    it("handles newlines by creating separate rows", () => {
      const segments: StyledSegment[] = [
        {
          text: "Line 1\nLine 2\nLine 3",
          styling: { type: "text" },
        },
      ];

      const rows = splitStyledSegmentsIntoRows(segments, 80);

      expect(rows).toHaveLength(3);
      expect(rows[0][0].text).toBe("Line 1");
      expect(rows[1][0].text).toBe("Line 2");
      expect(rows[2][0].text).toBe("Line 3");
    });

    it("preserves styling when splitting", () => {
      const segments: StyledSegment[] = [
        {
          text: "This is bold text that needs to be split",
          styling: { bold: true },
        },
      ];

      const rows = splitStyledSegmentsIntoRows(segments, 20);

      rows.forEach((row) => {
        row.forEach((segment) => {
          expect(segment.styling.bold).toBe(true);
        });
      });
    });

    it("handles words longer than terminal width", () => {
      const segments: StyledSegment[] = [
        {
          text: "supercalifragilisticexpialidocious",
          styling: { type: "text" },
        },
      ];

      const rows = splitStyledSegmentsIntoRows(segments, 20);

      expect(rows.length).toBeGreaterThan(1);
      // Should split the long word by characters
      let totalChars = 0;
      rows.forEach((row) => {
        row.forEach((segment) => {
          totalChars += segment.text.length;
        });
      });
      expect(totalChars).toBe("supercalifragilisticexpialidocious".length);
    });

    it("merges segments with same styling", () => {
      const segments: StyledSegment[] = [
        { text: "Hello", styling: { bold: true } },
        { text: "world", styling: { bold: true } },
      ];

      const rows = splitStyledSegmentsIntoRows(segments, 80);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveLength(1);
      // Expect a space to be added between words during word processing
      expect(rows[0][0]).toEqual({
        text: "Hello world",
        styling: { bold: true },
      });
    });

    it("handles empty segments", () => {
      const segments: StyledSegment[] = [];
      const rows = splitStyledSegmentsIntoRows(segments, 80);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual([]);
    });
  });

  describe("StyledSegmentRenderer", () => {
    it("renders styled segments as React components", () => {
      const segments: StyledSegment[] = [
        { text: "Bold text", styling: { bold: true } },
        { text: " normal text", styling: { type: "text" } },
      ];

      const { lastFrame } = render(
        <StyledSegmentRenderer segments={segments} />,
      );

      // Should contain the text content
      expect(lastFrame()).toContain("Bold text normal text");
    });

    it("handles empty segments", () => {
      const segments: StyledSegment[] = [];

      const { lastFrame } = render(
        <StyledSegmentRenderer segments={segments} />,
      );

      expect(lastFrame()).toBe("");
    });
  });
});
