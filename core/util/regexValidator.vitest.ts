import { describe, expect, it } from "vitest";
import {
  escapeLiteralForRegex,
  looksLikeLiteralSearch,
  prepareQueryForRipgrep,
  validateAndSanitizeRegex,
} from "./regexValidator";

describe("validateAndSanitizeRegex", () => {
  it("should accept valid basic regex patterns", () => {
    const result = validateAndSanitizeRegex("function\\s+\\w+");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("function\\s+\\w+");
    expect(result.error).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });

  it("should fix triple-escaped sequences", () => {
    const result = validateAndSanitizeRegex("\\\\\\");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("\\\\");
    expect(result.warning).toContain("Fixed: Triple backslash sequences");
  });

  it("should fix raw tab characters", () => {
    const result = validateAndSanitizeRegex("hello\tworld");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("hello\\tworld");
    expect(result.warning).toContain("Fixed: Raw whitespace characters");
  });

  it("should fix raw newline characters", () => {
    const result = validateAndSanitizeRegex("line1\nline2");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("line1\\nline2");
    expect(result.warning).toContain("Fixed: Raw whitespace characters");
  });

  it("should warn about unescaped brackets without fixing", () => {
    const result = validateAndSanitizeRegex("hello[world]");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("hello[world]");
    expect(result.warning).toContain(
      "Warning: Unescaped brackets or parentheses",
    );
  });

  it("should handle multiple issues", () => {
    const result = validateAndSanitizeRegex("function()\t\\\\\\");
    expect(result.isValid).toBe(true);
    expect(result.sanitizedQuery).toBe("function()\\t\\\\");
    expect(result.warning).toContain("Fixed: Raw whitespace characters");
    expect(result.warning).toContain("Fixed: Triple backslash sequences");
  });

  it("should warn about lookbehind assertions", () => {
    const result = validateAndSanitizeRegex("(?<=foo)bar");
    expect(result.isValid).toBe(true);
    expect(result.warning).toContain(
      "Lookahead/lookbehind assertions require ripgrep to be compiled with PCRE2",
    );
  });
});

describe("escapeLiteralForRegex", () => {
  it("should escape basic regex metacharacters", () => {
    expect(escapeLiteralForRegex("hello.world")).toBe("hello\\.world");
    expect(escapeLiteralForRegex("test*")).toBe("test\\*");
    expect(escapeLiteralForRegex("file+")).toBe("file\\+");
    expect(escapeLiteralForRegex("query?")).toBe("query\\?");
  });

  it("should escape brackets and braces", () => {
    expect(escapeLiteralForRegex("array[0]")).toBe("array\\[0\\]");
    expect(escapeLiteralForRegex("{key}")).toBe("\\{key\\}");
    expect(escapeLiteralForRegex("func()")).toBe("func\\(\\)");
  });

  it("should handle multiple metacharacters", () => {
    expect(escapeLiteralForRegex("$regex.test(input)")).toBe(
      "\\$regex\\.test\\(input\\)",
    );
  });

  it("should not escape normal characters", () => {
    expect(escapeLiteralForRegex("hello world")).toBe("hello world");
  });
});

describe("looksLikeLiteralSearch", () => {
  it("should identify literal searches with unescaped metacharacters", () => {
    expect(looksLikeLiteralSearch("hello.world")).toBe(true);
    expect(looksLikeLiteralSearch("test*")).toBe(true);
    expect(looksLikeLiteralSearch("func()")).toBe(true);
    expect(looksLikeLiteralSearch("array[0]")).toBe(true);
  });

  it("should not identify regex patterns as literal", () => {
    expect(looksLikeLiteralSearch("hello\\.world")).toBe(false);
    expect(looksLikeLiteralSearch("\\d+")).toBe(false);
    expect(looksLikeLiteralSearch("[a-z]+")).toBe(false);
    expect(looksLikeLiteralSearch("a{2,4}")).toBe(false);
  });

  it("should handle plain text", () => {
    expect(looksLikeLiteralSearch("hello world")).toBe(false);
    expect(looksLikeLiteralSearch("simple text")).toBe(false);
  });
});

describe("prepareQueryForRipgrep", () => {
  it("should escape literal-looking queries", () => {
    const result = prepareQueryForRipgrep("hello.world");
    expect(result.query).toBe("hello.world");
  });

  it("should sanitize regex patterns", () => {
    const result = prepareQueryForRipgrep("function\t\\\\\\");
    expect(result.query).toBe("function\\t\\\\");
    expect(result.warning).toContain("Fixed:");
  });

  it("should handle plain text without changes", () => {
    const result = prepareQueryForRipgrep("hello world");
    expect(result.query).toBe("hello world");
    expect(result.warning).toBeUndefined();
  });

  describe("real-world examples", () => {
    it("should escape file patterns", () => {
      const result = prepareQueryForRipgrep("*.js");
      expect(result.query).toBe("*.js");
    });

    it("should escape function calls", () => {
      const result = prepareQueryForRipgrep("console.log()");
      expect(result.query).toBe("console.log()");
    });

    it("should not escape proper regex patterns", () => {
      const result = prepareQueryForRipgrep("function\\s+\\w+");
      expect(result.query).toBe("function\\s+\\w+");
      expect(result.warning).toBeUndefined();
    });
  });
});

describe("problematic patterns that originally failed", () => {
  it("should handle triple-escaped quotes", () => {
    const result = prepareQueryForRipgrep('\\\\\\"');
    expect(result.query).toBe('\\\\"'); // Triple backslash -> double backslash, quote stays
    expect(result.warning).toContain("Fixed:");
  });

  it("should handle newline-tab sequences", () => {
    const result = prepareQueryForRipgrep("\n\t");
    expect(result.query).toBe("\\n\\t");
    expect(result.warning).toContain("Fixed:");
  });

  it("should handle dollar signs in shell patterns", () => {
    const result = prepareQueryForRipgrep("$(command)");
    expect(result.query).toBe("$(command)");
  });

  it("should handle escaped dollar signs", () => {
    const result = prepareQueryForRipgrep("\\$\\(");
    expect(result.query).toBe("\\$\\(");
    expect(result.warning).toBeUndefined();
  });
});

describe("patterns that should NOT be over-sanitized", () => {
  describe("valid regex patterns that contain suspicious sequences", () => {
    it("should not escape properly formed character classes", () => {
      const result = prepareQueryForRipgrep("[a-zA-Z0-9_-]+");
      expect(result.query).toBe("[a-zA-Z0-9_-]+");
      expect(result.warning).toContain("Warning: Unescaped brackets"); // Warn but don't break
    });

    it("should not escape quantifiers in regex patterns", () => {
      const result = prepareQueryForRipgrep("\\w{2,5}");
      expect(result.query).toBe("\\w{2,5}");
      expect(result.warning).toBeUndefined();
    });

    it("should not escape properly formed lookarounds", () => {
      const result = prepareQueryForRipgrep("(?<!\\w)test(?!\\w)");
      expect(result.query).toBe("(?<!\\w)test(?!\\w)");
      expect(result.warning).toContain("Lookahead/lookbehind assertions"); // Warn about compatibility
    });

    it("should not break escaped metacharacters in regex", () => {
      const result = prepareQueryForRipgrep("console\\.log\\(\\)");
      expect(result.query).toBe("console\\.log\\(\\)");
      expect(result.warning).toBeUndefined();
    });
  });

  describe("patterns that look problematic but are intentional", () => {
    it("should not over-escape already escaped sequences", () => {
      const result = prepareQueryForRipgrep("\\\\t"); // Already escaped tab
      expect(result.query).toBe("\\\\t");
      expect(result.warning).toBeUndefined();
    });

    it("should not double-escape backslashes in Windows paths", () => {
      const result = prepareQueryForRipgrep("C:\\\\Users\\\\file");
      expect(result.query).toBe("C:\\\\Users\\\\file");
      expect(result.warning).toBeUndefined();
    });

    it("should not break raw strings that contain regex-like patterns", () => {
      const result = prepareQueryForRipgrep('"\\d+\\s+\\w+"');
      expect(result.query).toBe('"\\d+\\s+\\w+"'); // Escaped sequences in quotes should stay
      expect(result.warning).toBeUndefined();
    });

    it("should not break JSON with escaped quotes", () => {
      const result = prepareQueryForRipgrep('"key": "value"');
      expect(result.query).toBe('"key": "value"');
      expect(result.warning).toBeUndefined();
    });
  });

  describe("complex patterns that mix literal and regex", () => {
    it("should not break URLs with query parameters", () => {
      const result = prepareQueryForRipgrep(
        "https://api\\.example\\.com\\?param=\\w+",
      );
      expect(result.query).toBe("https://api\\.example\\.com\\?param=\\w+");
      expect(result.warning).toBeUndefined();
    });

    it("should not break file paths with regex metacharacters", () => {
      const result = prepareQueryForRipgrep("/path/to/file\\.[jt]sx?");
      expect(result.query).toBe("/path/to/file\\.[jt]sx?");
      expect(result.warning).toContain("Warning: Unescaped brackets"); // Warn but preserve
    });

    it("should handle mixed escaped and unescaped patterns correctly", () => {
      // This is a regex that matches function calls with optional whitespace
      const result = prepareQueryForRipgrep("\\w+\\s*\\(");
      expect(result.query).toBe("\\w+\\s*\\(");
      expect(result.warning).toBeUndefined();
    });
  });

  describe("edge cases that could trigger false positives", () => {
    it("should not treat mathematical expressions as problematic", () => {
      const result = prepareQueryForRipgrep("a + b * c");
      expect(result.query).toBe("a + b * c"); // Should be escaped as literal
    });

    it("should not break regex that uses word boundaries", () => {
      const result = prepareQueryForRipgrep("\\bclass\\b");
      expect(result.query).toBe("\\bclass\\b");
      expect(result.warning).toBeUndefined();
    });

    it("should not break negated character classes", () => {
      const result = prepareQueryForRipgrep("[^a-z]+");
      expect(result.query).toBe("[^a-z]+");
      expect(result.warning).toContain("Warning: Unescaped brackets"); // Warn but preserve
    });

    it("should not treat IPv4 addresses as problematic regex", () => {
      const result = prepareQueryForRipgrep("192.168.1.1");
      expect(result.query).toBe("192.168.1.1"); // Should be escaped as literal
    });

    it("should not break hex color codes", () => {
      const result = prepareQueryForRipgrep("#[0-9a-fA-F]{6}");
      expect(result.query).toBe("#[0-9a-fA-F]{6}");
      expect(result.warning).toContain("Warning: Unescaped brackets"); // Warn but preserve regex
    });
  });

  describe("patterns that should preserve user intent", () => {
    it("should not sanitize intentional regex alternation", () => {
      const result = prepareQueryForRipgrep("(foo|bar)");
      expect(result.query).toBe("(foo|bar)"); // Should be escaped as literal since unescaped
    });

    it("should preserve escaped alternation in regex", () => {
      const result = prepareQueryForRipgrep("\\(foo\\|bar\\)");
      expect(result.query).toBe("\\(foo\\|bar\\)");
      expect(result.warning).toBeUndefined();
    });

    it("should not break SQL LIKE patterns when used as literal search", () => {
      const result = prepareQueryForRipgrep("name LIKE '%john%'");
      expect(result.query).toBe("name LIKE '%john%'"); // No regex metacharacters here
      expect(result.warning).toBeUndefined();
    });
  });
});
