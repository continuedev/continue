import {
  truncateOutputFromStart,
  TRUNCATION_MAX_CHARACTERS,
  TRUNCATION_MAX_LINES,
} from "./truncateOutput.js";

describe("truncateOutputFromStart", () => {
  describe("no truncation needed", () => {
    it("should return empty string unchanged", () => {
      const result = truncateOutputFromStart("");
      expect(result.output).toBe("");
      expect(result.wasTruncated).toBe(false);
    });

    it("should return short output unchanged", () => {
      const input = "hello world\nline 2\nline 3";
      const result = truncateOutputFromStart(input);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });

    it("should return output at exactly max lines unchanged", () => {
      const lines = Array.from(
        { length: TRUNCATION_MAX_LINES },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });

    it("should return output at exactly max characters unchanged", () => {
      const input = "a".repeat(TRUNCATION_MAX_CHARACTERS);
      const result = truncateOutputFromStart(input);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });
  });

  describe("truncation by line count", () => {
    it("should truncate when exceeding max lines", () => {
      const totalLines = TRUNCATION_MAX_LINES + 500;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 500 lines truncated)");
      expect(result.output).toContain("line 501");
      expect(result.output).toContain(`line ${totalLines}`);
      expect(result.output).not.toContain("line 500\n");
    });

    it("should preserve the last max lines when truncating", () => {
      const totalLines = TRUNCATION_MAX_LINES * 2;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain(
        `(previous ${TRUNCATION_MAX_LINES} lines truncated)`,
      );

      // Check that we have lines (MAX_LINES+1) to (MAX_LINES*2)
      const outputLines = result.output.split("\n");
      // First line is the truncation message, second is empty, then content
      expect(outputLines[2]).toBe(`line ${TRUNCATION_MAX_LINES + 1}`);
      expect(outputLines[outputLines.length - 1]).toBe(`line ${totalLines}`);
    });

    it("should handle exactly max lines + 1", () => {
      const totalLines = TRUNCATION_MAX_LINES + 1;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 1 lines truncated)");
      expect(result.output).toContain("line 2");
      expect(result.output).toContain(`line ${totalLines}`);
      expect(result.output).not.toContain("\nline 1\n");
    });
  });

  describe("truncation by character count", () => {
    it("should truncate when exceeding max characters", () => {
      // Create output that exceeds character limit but not line limit
      const input = "a".repeat(TRUNCATION_MAX_CHARACTERS + 10000);
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(
        TRUNCATION_MAX_CHARACTERS + 100 /* header allowance */,
      );
      expect(result.output).toContain("characters truncated");
    });

    it("should truncate at line boundary when possible", () => {
      // Create lines that exceed character limit
      const line = "x".repeat(100) + "\n";
      const input = line.repeat(600); // 60600 characters, 600 lines
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      // Should start at a line boundary (after truncation header)
      const contentStart = result.output.indexOf("\n\n") + 2;
      const content = result.output.slice(contentStart);
      // Content should start with 'x' (beginning of a line, not mid-line)
      expect(content[0]).toBe("x");
    });
  });

  describe("combined truncation", () => {
    it("should apply both line and character truncation with single message", () => {
      // Create lines that exceed both limits
      // 2x max lines, each 100 chars = way more than max characters
      const line = "y".repeat(100);
      const lines = Array.from(
        { length: TRUNCATION_MAX_LINES * 2 },
        () => line,
      );
      const input = lines.join("\n");

      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      // Should be truncated by lines first, then by characters
      expect(result.output.length).toBeLessThanOrEqual(
        TRUNCATION_MAX_CHARACTERS + 100 /* header allowance */,
      );

      // Should have a single combined message, not duplicate notes
      expect(result.output).toContain("previous output truncated:");
      expect(result.output).toContain(`${TRUNCATION_MAX_LINES} lines`);
      expect(result.output).toContain("characters removed");

      // Should NOT have separate line truncation message
      const truncationNoteCount = (result.output.match(/\(previous/g) || [])
        .length;
      expect(truncationNoteCount).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle single very long line without newlines", () => {
      const input = "z".repeat(TRUNCATION_MAX_CHARACTERS + 10000);
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("characters truncated");
      // Should keep approximately max chars (plus header)
      expect(result.output.length).toBeLessThanOrEqual(
        TRUNCATION_MAX_CHARACTERS + 100,
      );
      expect(result.output.length).toBeGreaterThan(TRUNCATION_MAX_CHARACTERS);
    });

    it("should not snap to line boundary if newline is too far into the text", () => {
      // Create a massive line followed by a newline far from the truncation point
      const leadingChars = TRUNCATION_MAX_CHARACTERS + 5000;
      const input = "a".repeat(leadingChars) + "\n" + "b".repeat(10);
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      // Should cut mid-line since newline is beyond snap threshold into kept text
      // Result should contain 'a' characters (cut mid-line)
      const contentStart = result.output.indexOf("\n\n") + 2;
      const content = result.output.slice(contentStart);
      expect(content[0]).toBe("a");
    });

    it("should snap to line boundary if newline is within snap threshold", () => {
      // Create text where truncation point lands within snap threshold of a newline
      const charsBeforeNewline = TRUNCATION_MAX_CHARACTERS / 5; // Well under max
      const input =
        "a".repeat(charsBeforeNewline) +
        "\n" +
        "b".repeat(TRUNCATION_MAX_CHARACTERS);
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      // Newline should be within snap threshold, so should start with 'b'
      const contentStart = result.output.indexOf("\n\n") + 2;
      const content = result.output.slice(contentStart);
      expect(content[0]).toBe("b");
    });

    it("should handle output with only newlines", () => {
      const input = "\n".repeat(TRUNCATION_MAX_LINES + 500);
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("lines truncated)");
    });

    it("should handle mixed content with empty lines", () => {
      const totalLines = TRUNCATION_MAX_LINES + 200;
      const lines = Array.from({ length: totalLines }, (_, i) =>
        i % 2 === 0 ? `content line ${i}` : "",
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 200 lines truncated)");
    });
  });
});
