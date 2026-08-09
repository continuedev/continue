import {
  parseEnvNumber,
  truncateByLinesAndChars,
  truncateLinesByCount,
  truncateOutputFromEnd,
  truncateOutputFromStart,
} from "./truncateOutput.js";

// Test constants matching the bash tool defaults
const DEFAULT_MAX_CHARS = 50000;
const DEFAULT_MAX_LINES = 1000;

const defaultLimits = {
  maxChars: DEFAULT_MAX_CHARS,
  maxLines: DEFAULT_MAX_LINES,
};

describe("truncateOutputFromStart", () => {
  describe("no truncation needed", () => {
    it("should return empty string unchanged", () => {
      const result = truncateOutputFromStart("", defaultLimits);
      expect(result.output).toBe("");
      expect(result.wasTruncated).toBe(false);
    });

    it("should return short output unchanged", () => {
      const input = "hello world\nline 2\nline 3";
      const result = truncateOutputFromStart(input, defaultLimits);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });

    it("should return output at exactly max lines unchanged", () => {
      const lines = Array.from(
        { length: DEFAULT_MAX_LINES },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, defaultLimits);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });

    it("should return output at exactly max characters unchanged", () => {
      const input = "a".repeat(DEFAULT_MAX_CHARS);
      const result = truncateOutputFromStart(input, defaultLimits);
      expect(result.output).toBe(input);
      expect(result.wasTruncated).toBe(false);
    });
  });

  describe("truncation by line count", () => {
    it("should truncate when exceeding max lines", () => {
      const totalLines = DEFAULT_MAX_LINES + 500;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 500 lines truncated)");
      expect(result.output).toContain("line 501");
      expect(result.output).toContain(`line ${totalLines}`);
      expect(result.output).not.toContain("line 500\n");
    });

    it("should preserve the last max lines when truncating", () => {
      const totalLines = DEFAULT_MAX_LINES * 2;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain(
        `(previous ${DEFAULT_MAX_LINES} lines truncated)`,
      );

      // Check that we have lines (MAX_LINES+1) to (MAX_LINES*2)
      const outputLines = result.output.split("\n");
      // First line is the truncation message, second is empty, then content
      expect(outputLines[2]).toBe(`line ${DEFAULT_MAX_LINES + 1}`);
      expect(outputLines[outputLines.length - 1]).toBe(`line ${totalLines}`);
    });

    it("should handle exactly max lines + 1", () => {
      const totalLines = DEFAULT_MAX_LINES + 1;
      const lines = Array.from(
        { length: totalLines },
        (_, i) => `line ${i + 1}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, defaultLimits);

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
      const input = "a".repeat(DEFAULT_MAX_CHARS + 10000);
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(
        DEFAULT_MAX_CHARS + 100 /* header allowance */,
      );
      expect(result.output).toContain("characters truncated");
    });

    it("should truncate at line boundary when possible", () => {
      // Create lines that exceed character limit
      const line = "x".repeat(100) + "\n";
      const input = line.repeat(600); // 60600 characters, 600 lines
      const result = truncateOutputFromStart(input, defaultLimits);

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
      const lines = Array.from({ length: DEFAULT_MAX_LINES * 2 }, () => line);
      const input = lines.join("\n");

      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      // Should be truncated by lines first, then by characters
      expect(result.output.length).toBeLessThanOrEqual(
        DEFAULT_MAX_CHARS + 100 /* header allowance */,
      );

      // Should have a single combined message, not duplicate notes
      expect(result.output).toContain("previous output truncated:");
      expect(result.output).toContain(`${DEFAULT_MAX_LINES} lines`);
      expect(result.output).toContain("characters removed");

      // Should NOT have separate line truncation message
      const truncationNoteCount = (result.output.match(/\(previous/g) || [])
        .length;
      expect(truncationNoteCount).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("should handle single very long line without newlines", () => {
      const input = "z".repeat(DEFAULT_MAX_CHARS + 10000);
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("characters truncated");
      // Should keep approximately max chars (plus header)
      expect(result.output.length).toBeLessThanOrEqual(DEFAULT_MAX_CHARS + 100);
      expect(result.output.length).toBeGreaterThan(DEFAULT_MAX_CHARS);
    });

    it("should not snap to line boundary if newline is too far into the text", () => {
      // Create a massive line followed by a newline far from the truncation point
      const leadingChars = DEFAULT_MAX_CHARS + 5000;
      const input = "a".repeat(leadingChars) + "\n" + "b".repeat(10);
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      // Should cut mid-line since newline is beyond snap threshold into kept text
      // Result should contain 'a' characters (cut mid-line)
      const contentStart = result.output.indexOf("\n\n") + 2;
      const content = result.output.slice(contentStart);
      expect(content[0]).toBe("a");
    });

    it("should snap to line boundary if newline is within snap threshold", () => {
      // Create text where truncation point lands within snap threshold of a newline
      const charsBeforeNewline = DEFAULT_MAX_CHARS / 5; // Well under max
      const input =
        "a".repeat(charsBeforeNewline) + "\n" + "b".repeat(DEFAULT_MAX_CHARS);
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      // Newline should be within snap threshold, so should start with 'b'
      const contentStart = result.output.indexOf("\n\n") + 2;
      const content = result.output.slice(contentStart);
      expect(content[0]).toBe("b");
    });

    it("should handle output with only newlines", () => {
      const input = "\n".repeat(DEFAULT_MAX_LINES + 500);
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("lines truncated)");
    });

    it("should handle mixed content with empty lines", () => {
      const totalLines = DEFAULT_MAX_LINES + 200;
      const lines = Array.from({ length: totalLines }, (_, i) =>
        i % 2 === 0 ? `content line ${i}` : "",
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, defaultLimits);

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 200 lines truncated)");
    });
  });

  describe("with custom limits", () => {
    it("should use custom character limit", () => {
      const input = "a".repeat(1500);
      const result = truncateOutputFromStart(input, {
        maxChars: 1000,
        maxLines: 10000,
      });

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("characters truncated");
      // Output should be around 1000 chars plus header
      expect(result.output.length).toBeLessThanOrEqual(1100);
    });

    it("should use custom line limit", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, {
        maxChars: 100000,
        maxLines: 50,
      });

      expect(result.wasTruncated).toBe(true);
      expect(result.output).toContain("(previous 50 lines truncated)");
      expect(result.output).toContain("line 51");
      expect(result.output).toContain("line 100");
    });

    it("should use both custom limits together", () => {
      // Create 200 lines of 10 chars each = 2000+ chars, exceeding both limits
      const lines = Array.from({ length: 200 }, () => "x".repeat(10));
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, {
        maxChars: 500,
        maxLines: 100,
      });

      expect(result.wasTruncated).toBe(true);
      // Should be truncated by lines first (to 100), then by characters (to ~500)
      expect(result.output.length).toBeLessThanOrEqual(600);
    });

    it("should not truncate when output is under custom limits", () => {
      // Create output that would exceed default limits but not custom ones
      const lines = Array.from(
        { length: DEFAULT_MAX_LINES + 500 },
        (_, i) => `line ${i}`,
      );
      const input = lines.join("\n");
      const result = truncateOutputFromStart(input, {
        maxChars: 100000,
        maxLines: 10000,
      });

      expect(result.wasTruncated).toBe(false);
      expect(result.output).toBe(input);
    });
  });
});

describe("parseEnvNumber", () => {
  it("should return default when env var is undefined", () => {
    expect(parseEnvNumber(undefined, 1000)).toBe(1000);
  });

  it("should return env var value when set to valid number", () => {
    expect(parseEnvNumber("5000", 1000)).toBe(5000);
  });

  it("should return default when env var is empty string", () => {
    expect(parseEnvNumber("", 1000)).toBe(1000);
  });

  it("should return default when env var is not a number", () => {
    expect(parseEnvNumber("not-a-number", 1000)).toBe(1000);
  });

  it("should return default when env var is zero", () => {
    expect(parseEnvNumber("0", 1000)).toBe(1000);
  });

  it("should return default when env var is negative", () => {
    expect(parseEnvNumber("-100", 1000)).toBe(1000);
  });

  it("should parse integer from float string", () => {
    expect(parseEnvNumber("12345.67", 1000)).toBe(12345);
  });
});

describe("truncateOutputFromEnd", () => {
  it("should return empty string unchanged", () => {
    const result = truncateOutputFromEnd("", 1000);
    expect(result.output).toBe("");
    expect(result.wasTruncated).toBe(false);
  });

  it("should return short output unchanged", () => {
    const input = "hello world";
    const result = truncateOutputFromEnd(input, 1000);
    expect(result.output).toBe(input);
    expect(result.wasTruncated).toBe(false);
  });

  it("should truncate from end when exceeding max chars", () => {
    const input = "a".repeat(100) + "b".repeat(100);
    const result = truncateOutputFromEnd(input, 100);

    expect(result.wasTruncated).toBe(true);
    expect(result.output).toContain("a".repeat(100));
    expect(result.output).not.toContain("b");
    expect(result.output).toContain("characters");
    expect(result.output).toContain("truncated");
  });

  it("should include context in truncation message", () => {
    const input = "x".repeat(200);
    const result = truncateOutputFromEnd(input, 100, "file content");

    expect(result.wasTruncated).toBe(true);
    expect(result.output).toContain("of file content");
  });

  it("should snap to line boundary when possible", () => {
    const input = "line1\nline2\nline3\nline4\nline5";
    const result = truncateOutputFromEnd(input, 15);

    expect(result.wasTruncated).toBe(true);
    // Should end at a line boundary
    expect(result.output).toContain("line1\nline2");
  });
});

describe("truncateLinesByCount", () => {
  it("should return empty string unchanged", () => {
    const result = truncateLinesByCount("", 100);
    expect(result.output).toBe("");
    expect(result.wasTruncated).toBe(false);
  });

  it("should return output unchanged when under limit", () => {
    const input = "line1\nline2\nline3";
    const result = truncateLinesByCount(input, 10);
    expect(result.output).toBe(input);
    expect(result.wasTruncated).toBe(false);
  });

  it("should truncate lines from end", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const input = lines.join("\n");
    const result = truncateLinesByCount(input, 50);

    expect(result.wasTruncated).toBe(true);
    expect(result.output).toContain("line 1");
    expect(result.output).toContain("line 50");
    expect(result.output).not.toContain("line 51");
    expect(result.output).toContain("50 lines");
    expect(result.output).toContain("truncated");
  });

  it("should include context in truncation message", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const input = lines.join("\n");
    const result = truncateLinesByCount(input, 50, "test output");

    expect(result.output).toContain("of test output");
  });
});

describe("truncateByLinesAndChars", () => {
  it("should return empty string unchanged", () => {
    const result = truncateByLinesAndChars("", 100, 1000);
    expect(result.output).toBe("");
    expect(result.wasTruncated).toBe(false);
  });

  it("should truncate by lines first", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const input = lines.join("\n");
    const result = truncateByLinesAndChars(input, 50, 100000);

    expect(result.wasTruncated).toBe(true);
    expect(result.output).toContain("line 1");
    expect(result.output).toContain("line 50");
    expect(result.output).not.toContain("line 51");
  });

  it("should truncate by chars after lines if still too long", () => {
    // Create 50 lines of 100 chars each = 5000+ chars
    const lines = Array.from({ length: 50 }, () => "x".repeat(100));
    const input = lines.join("\n");
    const result = truncateByLinesAndChars(input, 100, 500);

    expect(result.wasTruncated).toBe(true);
    // Output should be around 500 chars plus truncation message
    expect(result.output.length).toBeLessThan(700);
  });

  it("should include context in truncation message", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
    const input = lines.join("\n");
    const result = truncateByLinesAndChars(input, 50, 100000, "file content");

    expect(result.output).toContain("of file content");
  });
});
