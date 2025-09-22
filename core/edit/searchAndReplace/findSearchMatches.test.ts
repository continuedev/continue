import { findSearchMatches } from "./findSearchMatch";

describe("findSearchMatches", () => {
  describe("exact match strategy", () => {
    it("should find single occurrence", () => {
      const content = "const foo = 'bar';";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 6,
        endIndex: 9,
        strategyName: "exactMatch",
      });
    });

    it("should find multiple occurrences", () => {
      const content = "const foo = 'foo';";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        startIndex: 6,
        endIndex: 9,
        strategyName: "exactMatch",
      });
      expect(matches[1]).toEqual({
        startIndex: 13,
        endIndex: 16,
        strategyName: "exactMatch",
      });
    });

    it("should find overlapping pattern occurrences correctly", () => {
      const content = "aaaa";
      const search = "aa";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 2,
        strategyName: "exactMatch",
      });
      expect(matches[1]).toEqual({
        startIndex: 2,
        endIndex: 4,
        strategyName: "exactMatch",
      });
    });

    it("should return empty array when no matches found", () => {
      const content = "const bar = 'baz';";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toEqual([]);
    });

    it("should handle multi-line content", () => {
      const content = `line 1 foo
line 2 bar
line 3 foo`;
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        startIndex: 7,
        endIndex: 10,
        strategyName: "exactMatch",
      });
      expect(matches[1]).toEqual({
        startIndex: 29,
        endIndex: 32,
        strategyName: "exactMatch",
      });
    });
  });

  describe("trimmed match strategy", () => {
    it("should find trimmed occurrences when exact match fails", () => {
      const content = "const foo = 'bar';";
      const search = "  foo  ";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 6,
        endIndex: 9,
        strategyName: "trimmedMatch",
      });
    });

    it("should find multiple trimmed occurrences", () => {
      const content = "const foo = 'foo';";
      const search = "  foo  ";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        startIndex: 6,
        endIndex: 9,
        strategyName: "trimmedMatch",
      });
      expect(matches[1]).toEqual({
        startIndex: 13,
        endIndex: 16,
        strategyName: "trimmedMatch",
      });
    });
  });

  describe("whitespace ignored match strategy", () => {
    it("should find matches ignoring internal whitespace", () => {
      const content = "const foo = bar;";
      const search = "const   foo=bar";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 15,
        strategyName: "whitespaceIgnoredMatch",
      });
    });

    it("should find multiple matches ignoring whitespace", () => {
      const content = `const foo = bar;
const baz = foo;`;
      const search = "const foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 9,
        strategyName: "exactMatch",
      });
    });

    it("should handle complex whitespace patterns", () => {
      const content = `function test() {
  return true;
}`;
      const search = "function test(){return true;}";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 34,
        strategyName: "whitespaceIgnoredMatch",
      });
    });
  });

  describe("empty search content", () => {
    it("should return single match at position 0 for empty string", () => {
      const content = "const foo = 'bar';";
      const search = "";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });

    it("should return single match at position 0 for whitespace-only string", () => {
      const content = "const foo = 'bar';";
      const search = "   \n\t  ";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle searching in empty content", () => {
      const content = "";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toEqual([]);
    });

    it("should handle searching for content at the beginning", () => {
      const content = "foo bar baz";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 3,
        strategyName: "exactMatch",
      });
    });

    it("should handle searching for content at the end", () => {
      const content = "foo bar baz";
      const search = "baz";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 8,
        endIndex: 11,
        strategyName: "exactMatch",
      });
    });

    it("should handle searching for the entire content", () => {
      const content = "foo bar baz";
      const search = "foo bar baz";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 11,
        strategyName: "exactMatch",
      });
    });

    it("should handle special characters", () => {
      const content = "const regex = /[a-z]+/g;";
      const search = "/[a-z]+/g";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 14,
        endIndex: 23,
        strategyName: "exactMatch",
      });
    });

    it("should handle Unicode characters", () => {
      const content = "const emoji = '🚀 Hello 🌍';";
      const search = "🚀 Hello 🌍";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 15,
        endIndex: 26,
        strategyName: "exactMatch",
      });
    });
  });

  describe("performance considerations", () => {
    it("should handle long content with multiple matches", () => {
      const repeatedContent = "foo bar ".repeat(1000);
      const search = "foo";
      const matches = findSearchMatches(repeatedContent, search);

      expect(matches).toHaveLength(1000);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 3,
        strategyName: "exactMatch",
      });
      expect(matches[999]).toEqual({
        startIndex: 7992,
        endIndex: 7995,
        strategyName: "exactMatch",
      });
    });

    it("should prevent infinite loops on edge cases", () => {
      const content = "aaaa";
      const search = "";
      const matches = findSearchMatches(content, search);

      // Should only return one match for empty search
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual({
        startIndex: 0,
        endIndex: 0,
        strategyName: "emptySearch",
      });
    });
  });

  describe("strategy selection", () => {
    it("should use exact match strategy when possible", () => {
      const content = "const foo = bar;";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0].strategyName).toBe("exactMatch");
    });

    it("should fallback to trimmed match when exact fails", () => {
      const content = "const foo = bar;";
      const search = "  foo  ";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0].strategyName).toBe("trimmedMatch");
    });

    it("should fallback to whitespace ignored when others fail", () => {
      const content = "const foo = bar;";
      const search = "const   foo=bar";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0].strategyName).toBe("whitespaceIgnoredMatch");
    });
  });

  describe("complex patterns", () => {
    it("should handle multiple matches with different line endings", () => {
      const content = "foo\r\nbar\r\nfoo\nfoo";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(3);
      expect(matches[0].startIndex).toBe(0);
      expect(matches[1].startIndex).toBe(10);
      expect(matches[2].startIndex).toBe(14);
    });

    it("should handle matches across different strategies", () => {
      const content = "const foo = 'bar';\n  const   foo='baz';";
      const search = "foo";
      const matches = findSearchMatches(content, search);

      // Both occurrences of "foo" should be found with exact match
      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        startIndex: 6,
        endIndex: 9,
        strategyName: "exactMatch",
      });
      expect(matches[1]).toEqual({
        startIndex: 29,
        endIndex: 32,
        strategyName: "exactMatch",
      });
    });

    it("should handle code with mixed indentation", () => {
      const content = `\tfunction test() {
    return true;
\t}`;
      const search = "function test(){return true;}";
      const matches = findSearchMatches(content, search);

      expect(matches).toHaveLength(1);
      expect(matches[0].strategyName).toBe("whitespaceIgnoredMatch");
    });
  });
});
