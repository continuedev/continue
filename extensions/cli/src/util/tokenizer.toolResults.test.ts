import { describe, expect, it, vi } from "vitest";

import { TOOL_RESULT_TOKEN_THRESHOLD } from "../constants/tokenization.js";

import {
  countToolResultTokens,
  shouldCheckCompactionAfterToolResults,
} from "./tokenizer.js";

// Mock gpt-tokenizer
vi.mock("gpt-tokenizer", () => ({
  encode: (text: string) => new Array(Math.ceil(text.length / 4)), // Rough 4 chars per token
}));

describe("Tool Results Tokenization", () => {
  describe("countToolResultTokens", () => {
    it("should count tokens for tool result content", () => {
      const content = "This is a tool result"; // 21 chars -> ~6 tokens
      const tokenCount = countToolResultTokens(content);
      expect(tokenCount).toBe(6);
    });

    it("should handle empty content", () => {
      const tokenCount = countToolResultTokens("");
      expect(tokenCount).toBe(0);
    });

    it("should handle large content", () => {
      const largeContent = "x".repeat(20000); // 20K chars -> ~5K tokens
      const tokenCount = countToolResultTokens(largeContent);
      expect(tokenCount).toBe(5000);
    });

    it("should fall back to character estimation on error", () => {
      // Mock encode to throw an error
      const mockEncode = vi.fn(() => {
        throw new Error("Tokenizer error");
      });
      vi.doMock("gpt-tokenizer", () => ({ encode: mockEncode }));

      const content = "test content"; // 12 chars -> 3 tokens fallback
      const tokenCount = countToolResultTokens(content);
      expect(tokenCount).toBe(3); // Math.ceil(12/4)
    });
  });

  describe("shouldCheckCompactionAfterToolResults", () => {
    it("should not trigger check for small results", () => {
      const toolResults = [
        "Small result 1", // ~4 tokens
        "Small result 2", // ~4 tokens
      ];

      const result = shouldCheckCompactionAfterToolResults(toolResults);
      
      expect(result.shouldCheck).toBe(false);
      expect(result.totalTokens).toBe(8);
      expect(result.largestResult).toBe(4);
    });

    it("should trigger check when results exceed threshold", () => {
      const largeContent = "x".repeat(60000); // 60K chars -> 15K tokens
      const toolResults = [
        largeContent, // 15K tokens - exactly at threshold
        "Small result", // ~3 tokens
      ];

      const result = shouldCheckCompactionAfterToolResults(toolResults);
      
      expect(result.shouldCheck).toBe(true);
      expect(result.totalTokens).toBe(15003);
      expect(result.largestResult).toBe(15000);
    });

    it("should use custom threshold", () => {
      const content = "x".repeat(12000); // 12K chars -> 3K tokens
      const toolResults = [content, content]; // 6K total tokens

      // Default threshold (15K) - should not trigger
      const resultDefault = shouldCheckCompactionAfterToolResults(toolResults);
      expect(resultDefault.shouldCheck).toBe(false);

      // Custom threshold (5K) - should trigger  
      const resultCustom = shouldCheckCompactionAfterToolResults(toolResults, 5000);
      expect(resultCustom.shouldCheck).toBe(true);
    });

    it("should handle single result", () => {
      const largeContent = "x".repeat(80000); // 80K chars -> 20K tokens
      const toolResults = [largeContent];

      const result = shouldCheckCompactionAfterToolResults(toolResults);
      
      expect(result.shouldCheck).toBe(true);
      expect(result.totalTokens).toBe(20000);
      expect(result.largestResult).toBe(20000);
    });

    it("should handle empty results array", () => {
      const result = shouldCheckCompactionAfterToolResults([]);
      
      expect(result.shouldCheck).toBe(false);
      expect(result.totalTokens).toBe(0);
      expect(result.largestResult).toBe(0);
    });

    it("should use configured default threshold", () => {
      // Create results just above the configured threshold
      const content = "x".repeat(TOOL_RESULT_TOKEN_THRESHOLD * 4 + 4); // Slightly over threshold
      const toolResults = [content];

      const result = shouldCheckCompactionAfterToolResults(toolResults);
      expect(result.shouldCheck).toBe(true);
      expect(result.totalTokens).toBeGreaterThan(TOOL_RESULT_TOKEN_THRESHOLD);
    });

    it("should track largest individual result correctly", () => {
      const toolResults = [
        "x".repeat(8000), // 2K tokens
        "x".repeat(40000), // 10K tokens (largest)
        "x".repeat(20000), // 5K tokens
      ];

      const result = shouldCheckCompactionAfterToolResults(toolResults);
      
      expect(result.shouldCheck).toBe(true);
      expect(result.totalTokens).toBe(17000); // 2K + 10K + 5K
      expect(result.largestResult).toBe(10000);
    });
  });
});