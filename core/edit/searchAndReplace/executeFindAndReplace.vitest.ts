import { describe, expect, it } from "vitest";
import { ContinueErrorReason } from "../../util/errors";
import { executeFindAndReplace } from "./performReplace";

describe("executeFindAndReplace", () => {
  describe("normal cases", () => {
    it("should replace single occurrence by default", () => {
      const content = "Hello world\nThis is a test file\nGoodbye";
      const result = executeFindAndReplace(content, "Hello", "Hi", false);

      expect(result).toBe("Hi world\nThis is a test file\nGoodbye");
    });

    it("should replace single occurrence when replaceAll is false", () => {
      const content = "Hello world\nHello again";
      const result = executeFindAndReplace(
        content,
        "Hello world",
        "Hi world",
        false,
      );

      expect(result).toBe("Hi world\nHello again");
    });

    it("should replace all occurrences when replaceAll is true", () => {
      const content = "Hello world\nHello again\nHello there";
      const result = executeFindAndReplace(content, "Hello", "Hi", true);

      expect(result).toBe("Hi world\nHi again\nHi there");
    });

    it("should handle empty new string (deletion)", () => {
      const content = "Hello world";
      const result = executeFindAndReplace(content, "Hello ", "", false);

      expect(result).toBe("world");
    });

    it("should handle empty old string replacement (insertion at start)", () => {
      const content = "";
      const result = executeFindAndReplace(content, "", "Hello world", false);

      expect(result).toBe("Hello world");
    });

    it("should preserve whitespace and indentation", () => {
      const content =
        "function test() {\n    const value = 'old';\n    return value;\n}";
      const result = executeFindAndReplace(
        content,
        "    const value = 'old';",
        "    const value = 'new';",
        false,
      );

      expect(result).toBe(
        "function test() {\n    const value = 'new';\n    return value;\n}",
      );
    });

    it("should handle multiline strings", () => {
      const content = "line1\nline2\nline3";
      const result = executeFindAndReplace(
        content,
        "line1\nline2",
        "newline1\nnewline2",
        false,
      );

      expect(result).toBe("newline1\nnewline2\nline3");
    });
  });

  describe("special character handling", () => {
    it("should handle regex special characters in old string", () => {
      const content = "const regex = /[a-z]+/g;";
      const result = executeFindAndReplace(
        content,
        "/[a-z]+/g",
        "/[A-Z]+/g",
        false,
      );

      expect(result).toBe("const regex = /[A-Z]+/g;");
    });

    it("should handle dollar signs in strings", () => {
      const content = 'const text = "Hello $world"';
      const result = executeFindAndReplace(
        content,
        '"Hello $world"',
        '"Hi $universe"',
        false,
      );

      expect(result).toBe('const text = "Hi $universe"');
    });

    it("should handle backslashes", () => {
      const content = 'const path = "C:\\Users\\test"';
      const result = executeFindAndReplace(
        content,
        "C:\\Users\\test",
        "D:\\Users\\test",
        false,
      );

      expect(result).toBe('const path = "D:\\Users\\test"');
    });

    it("should handle parentheses", () => {
      const content = "function test() { return 'old'; }";
      const result = executeFindAndReplace(
        content,
        "() { return 'old'; }",
        "() { return 'new'; }",
        false,
      );

      expect(result).toBe("function test() { return 'new'; }");
    });

    it("should handle square brackets", () => {
      const content = "const arr = [1, 2, 3];";
      const result = executeFindAndReplace(
        content,
        "[1, 2, 3]",
        "[4, 5, 6]",
        false,
      );

      expect(result).toBe("const arr = [4, 5, 6];");
    });
  });

  describe("replaceAll behavior", () => {
    it("should replace all occurrences including partial matches", () => {
      const content = "test testing tested test";
      const result = executeFindAndReplace(content, "test", "exam", true);

      expect(result).toBe("exam examing examed exam");
    });

    it("should replace all occurrences with empty string", () => {
      const content = "remove this remove that remove everything";
      const result = executeFindAndReplace(content, "remove ", "", true);

      expect(result).toBe("this that everything");
    });

    it("should handle overlapping patterns correctly", () => {
      const content = "aaaa";
      const result = executeFindAndReplace(content, "aa", "b", true);

      expect(result).toBe("bb");
    });
  });

  describe("error cases", () => {
    it("should throw error when string not found", () => {
      const content = "Hello world";

      expect(() => {
        executeFindAndReplace(content, "xyz", "abc", false);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceOldStringNotFound,
        }),
      );
    });

    it("should throw error with edit context when string not found", () => {
      const content = "Hello world";

      expect(() => {
        executeFindAndReplace(content, "xyz", "abc", false, 2);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceOldStringNotFound,
        }),
      );
    });

    it("should throw error when multiple occurrences exist and replaceAll is false", () => {
      const content = "Hello world\nHello again\nHello there";

      expect(() => {
        executeFindAndReplace(content, "Hello", "Hi", false);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMultipleOccurrences,
        }),
      );
    });

    it("should throw error with edit context for multiple occurrences", () => {
      const content = "test test test";

      expect(() => {
        executeFindAndReplace(content, "test", "exam", false, 1);
      }).toThrowError(
        expect.objectContaining({
          reason: ContinueErrorReason.FindAndReplaceMultipleOccurrences,
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("should handle single character replacement", () => {
      const content = "a b c";
      const result = executeFindAndReplace(content, "b", "x", false);

      expect(result).toBe("a x c");
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const content = `start${longString}end`;
      const result = executeFindAndReplace(content, longString, "short", false);

      expect(result).toBe("startshortend");
    });

    it("should handle strings at beginning of content", () => {
      const content = "start middle end";
      const result = executeFindAndReplace(content, "start", "begin", false);

      expect(result).toBe("begin middle end");
    });

    it("should handle strings at end of content", () => {
      const content = "start middle end";
      const result = executeFindAndReplace(content, "end", "finish", false);

      expect(result).toBe("start middle finish");
    });

    it("should handle entire content replacement", () => {
      const content = "replace everything";
      const result = executeFindAndReplace(
        content,
        "replace everything",
        "new content",
        false,
      );

      expect(result).toBe("new content");
    });
  });
});
