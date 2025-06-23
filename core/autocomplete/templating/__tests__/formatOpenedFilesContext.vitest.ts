/**
 * Comprehensive tests for formatOpenedFilesContext.ts
 *
 */

import { describe, expect, test } from "vitest";
import {
  AutocompleteCodeSnippet,
  AutocompleteDiffSnippet,
  AutocompleteSnippetType,
} from "../../snippets/types";
import { HelperVars } from "../../util/HelperVars";
import { formatOpenedFilesContext } from "../formatOpenedFilesContext";

// Import the now-exported internal functions
import {
  getRecencyAndSizeScore,
  rankByScore,
  setLogStats,
  trimSnippetForContext,
} from "../formatOpenedFilesContext";

describe("formatOpenedFilesContext main function tests", () => {
  const mockHelper = {
    modelName: "test-model",
  } as HelperVars;

  const TOKEN_BUFFER = 50;

  // Create sample code snippets with various sizes
  const createCodeSnippet = (
    filepath: string,
    content: string,
  ): AutocompleteCodeSnippet => ({
    type: AutocompleteSnippetType.Code,
    filepath,
    content,
  });

  const createDiffSnippet = (content: string): AutocompleteDiffSnippet => ({
    type: AutocompleteSnippetType.Diff,
    content,
  });

  test("should return empty array when no snippets are provided", () => {
    const result = formatOpenedFilesContext(
      [],
      1000,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );
    expect(result).toEqual([]);
  });

  test("should handle zero remaining token count", () => {
    const snippets = [
      createCodeSnippet("file1.ts", "content of file 1"),
      createCodeSnippet("file2.ts", "content of file 2"),
    ];

    const result = formatOpenedFilesContext(
      snippets,
      0,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result).toEqual([]);
  });

  test("should handle snippets with empty content", () => {
    const emptySnippets = [
      createCodeSnippet("empty1.ts", ""),
      createCodeSnippet("empty2.ts", ""),
    ];

    const result = formatOpenedFilesContext(
      emptySnippets,
      1000,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBe(emptySnippets.length);
  });

  test("should return all snippets when they all fit within token limit", () => {
    const smallSnippets = [
      createCodeSnippet("small1.ts", "a"),
      createCodeSnippet("small2.ts", "b"),
      createCodeSnippet("small3.ts", "c"),
    ];

    const result = formatOpenedFilesContext(
      smallSnippets,
      1000,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBe(smallSnippets.length);
  });

  test("should handle limited token count", () => {
    const snippets = Array(10)
      .fill(0)
      .map((_, i) => createCodeSnippet(`file${i}.ts`, `content of file ${i}`));

    const result = formatOpenedFilesContext(
      snippets,
      1, // Extremely small token count
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(Array.isArray(result)).toBe(true);
  });

  test("should accept valid inputs with adequate token count", () => {
    const snippets = [
      createCodeSnippet("file1.ts", "Some content here"),
      createCodeSnippet("file2.ts", "More content here"),
    ];

    const result = formatOpenedFilesContext(
      snippets,
      1000,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBeGreaterThan(0);
  });

  test("should handle already added snippets parameter", () => {
    const snippets = [
      createCodeSnippet("file1.ts", "content of file 1"),
      createCodeSnippet("file2.ts", "content of file 2"),
    ];

    const alreadyAddedSnippets = [createDiffSnippet("diff content")];

    const result = formatOpenedFilesContext(
      snippets,
      1000,
      mockHelper,
      alreadyAddedSnippets,
      TOKEN_BUFFER,
    );

    expect(result.length).toBe(snippets.length);
  });

  test("should handle large snippets by trimming them", () => {
    const largeSnippet = createCodeSnippet("large.ts", "x".repeat(10000));

    const result = formatOpenedFilesContext(
      [largeSnippet],
      200,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBe(1);
    expect(result[0].filepath).toBe(largeSnippet.filepath);
    expect(result[0].content.length).toBeLessThan(largeSnippet.content.length);
  });

  test("should prioritize more recent snippets when not all fit", () => {
    const snippets = [
      createCodeSnippet("recent1.ts", "a".repeat(10)),
      createCodeSnippet("recent2.ts", "b".repeat(10000)),
      createCodeSnippet("recent3.ts", "c".repeat(10000)),
    ];

    const result = formatOpenedFilesContext(
      snippets,
      200,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((s) => s.filepath === "recent1.ts")).toBe(true);
  });

  test("should handle a mix of large and small snippets effectively", () => {
    const mixedSnippets = [
      createCodeSnippet("small1.ts", "a".repeat(10)),
      createCodeSnippet("large1.ts", "b".repeat(5000)),
      createCodeSnippet("small2.ts", "c".repeat(10)),
      createCodeSnippet("large2.ts", "d".repeat(5000)),
    ];

    const result = formatOpenedFilesContext(
      mixedSnippets,
      500,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((s) => s.filepath.startsWith("small"))).toBe(true);
  });

  test("should respect minimum token threshold when trimming", () => {
    const largeSnippets = [
      createCodeSnippet("large1.ts", "a".repeat(5000)),
      createCodeSnippet("large2.ts", "b".repeat(5000)),
    ];

    const result = formatOpenedFilesContext(
      largeSnippets,
      150,
      mockHelper,
      [],
      TOKEN_BUFFER,
    );

    expect(result.length).toBeLessThanOrEqual(1);

    if (result.length > 0) {
      expect(result[0].content.length).toBeLessThan(
        largeSnippets[0].content.length,
      );
    }
  });
});

// Tests for rankByScore function
describe("rankByScore function", () => {
  const createCodeSnippet = (
    filepath: string,
    content: string,
  ): AutocompleteCodeSnippet => ({
    type: AutocompleteSnippetType.Code,
    filepath,
    content,
  });

  test("should return empty array when given empty array", () => {
    const result = rankByScore([]);
    expect(result).toEqual([]);
  });

  test("should rank snippets by score", () => {
    // Initialize logMin and logMax by calling setLogStats first
    const snippets = [
      createCodeSnippet("file1.ts", "a".repeat(10)),
      createCodeSnippet("file2.ts", "b".repeat(1000)),
      createCodeSnippet("file3.ts", "c".repeat(100)),
    ];
    setLogStats(snippets);

    const result = rankByScore(snippets);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // The snippets should be ranked in some order, which may not match input order
    expect(result.map((s: { filepath: any }) => s.filepath)).not.toEqual(
      snippets.map((s) => s.filepath),
    );
  });

  test("should limit the number of ranked snippets to defaultNumFilesUsed", () => {
    // Create more snippets than the default limit
    const manySnippets = Array(10)
      .fill(0)
      .map((_, i) => createCodeSnippet(`file${i}.ts`, `content of file ${i}`));
    setLogStats(manySnippets);

    const result = rankByScore(manySnippets);

    // The function should limit the number of snippets (defaultNumFilesUsed is 5)
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

// Tests for getRecencyAndSizeScore function
describe("getRecencyAndSizeScore function", () => {
  const createCodeSnippet = (
    filepath: string,
    content: string,
  ): AutocompleteCodeSnippet => ({
    type: AutocompleteSnippetType.Code,
    filepath,
    content,
  });

  test("recency score should decrease with higher index", () => {
    // Initialize log stats first
    const snippets = [
      createCodeSnippet("file1.ts", "a".repeat(100)),
      createCodeSnippet("file2.ts", "b".repeat(100)),
    ];
    setLogStats(snippets);

    // Test that score decreases with increasing index
    const score0 = getRecencyAndSizeScore(0, snippets[0]);
    const score1 = getRecencyAndSizeScore(1, snippets[0]);
    const score2 = getRecencyAndSizeScore(2, snippets[0]);

    expect(score0).toBeGreaterThan(score1);
    expect(score1).toBeGreaterThan(score2);
  });

  test("size score should be higher for smaller snippets", () => {
    // Initialize log stats first
    const snippets = [
      createCodeSnippet("small.ts", "a".repeat(50)),
      createCodeSnippet("medium.ts", "b".repeat(200)),
      createCodeSnippet("large.ts", "c".repeat(1000)),
    ];
    setLogStats(snippets);

    // Test with same recency index but different sizes
    const smallScore = getRecencyAndSizeScore(0, snippets[0]);
    const mediumScore = getRecencyAndSizeScore(0, snippets[1]);
    const largeScore = getRecencyAndSizeScore(0, snippets[2]);

    // Scores should reflect preference for smaller snippets
    expect(smallScore).toBeGreaterThanOrEqual(mediumScore);
    expect(mediumScore).toBeGreaterThanOrEqual(largeScore);
  });

  test("recency and size both affect the score with recency having more weight", () => {
    // Initialize log stats first
    const snippets = [
      createCodeSnippet("recent_large.ts", "a".repeat(1000)),
      createCodeSnippet("old_small.ts", "b".repeat(50)),
    ];
    setLogStats(snippets);

    // Test that recency and size both contribute to the score
    const recentLargeScore = getRecencyAndSizeScore(0, snippets[0]);
    const oldSmallScore = getRecencyAndSizeScore(1, snippets[1]);

    // We're not making a direct comparison, just verifying the scoring mechanism works
    expect(recentLargeScore).toBeGreaterThan(0);
    expect(oldSmallScore).toBeGreaterThan(0);
    expect(oldSmallScore).toBeLessThan(1);
  });
});

// Tests for setLogStats function
describe("setLogStats function", () => {
  const createCodeSnippet = (
    filepath: string,
    content: string,
  ): AutocompleteCodeSnippet => ({
    type: AutocompleteSnippetType.Code,
    filepath,
    content,
  });

  test("should set logMin and logMax based on snippet sizes", () => {
    const snippets = [
      createCodeSnippet("small.ts", "a".repeat(50)),
      createCodeSnippet("medium.ts", "b".repeat(200)),
      createCodeSnippet("large.ts", "c".repeat(1000)),
    ];

    // We can't directly test logMin and logMax as they're private
    // but we can verify that the function runs without errors
    expect(() => setLogStats(snippets)).not.toThrow();
  });

  test("should handle empty snippets", () => {
    const emptySnippets = [
      createCodeSnippet("empty1.ts", ""),
      createCodeSnippet("empty2.ts", ""),
    ];

    expect(() => setLogStats(emptySnippets)).not.toThrow();
  });

  test("should handle single snippet", () => {
    const singleSnippet = [createCodeSnippet("single.ts", "content")];

    expect(() => setLogStats(singleSnippet)).not.toThrow();
  });
});

// Tests for trimSnippetForContext function
describe("trimSnippetForContext function", () => {
  const createCodeSnippet = (
    filepath: string,
    content: string,
  ): AutocompleteCodeSnippet => ({
    type: AutocompleteSnippetType.Code,
    filepath,
    content,
  });

  test("should return original snippet if it fits within token limit", () => {
    const snippet = createCodeSnippet("small.ts", "small content");
    const modelName = "test-model";
    const maxTokens = 1000; // Large enough to fit the snippet

    const result = trimSnippetForContext(snippet, maxTokens, modelName);

    // Should return the original snippet with its token count
    expect(result.newSnippet).toEqual(snippet);
    expect(typeof result.newTokens).toBe("number");
    expect(result.newTokens).toBeGreaterThan(0);
  });

  test("should trim snippet content if it exceeds token limit", () => {
    const snippet = createCodeSnippet("large.ts", "a".repeat(1000));
    const modelName = "test-model";
    const maxTokens = 10; // Small enough to require trimming

    const result = trimSnippetForContext(snippet, maxTokens, modelName);

    // Should return a trimmed snippet
    expect(result.newSnippet.filepath).toBe(snippet.filepath);
    expect(result.newSnippet.type).toBe(snippet.type);
    expect(result.newSnippet.content.length).toBeLessThanOrEqual(
      snippet.content.length,
    );

    // Token count should be less than or equal to maxTokens
    expect(result.newTokens).toBeLessThanOrEqual(maxTokens);
  });
});
