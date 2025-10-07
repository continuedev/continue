import { describe, expect, it, vi } from "vitest";

import {
  generateBranchName,
  generateBranchNameWithSuffix,
} from "./branchNameGenerator.js";

describe("branchNameGenerator", () => {
  const mockLlmApi = {
    chatCompletion: vi.fn(),
  } as any;

  describe("generateBranchName", () => {
    it("should generate a kebab-case branch name from LLM response", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "fix-login-bug",
            },
          },
        ],
      });

      const result = await generateBranchName(mockLlmApi, "Fix the login bug");
      expect(result).toBe("fix-login-bug");
    });

    it("should clean up branch names with special characters", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "Fix Login Bug!!!",
            },
          },
        ],
      });

      const result = await generateBranchName(mockLlmApi, "Fix the login bug");
      expect(result).toBe("fix-login-bug");
    });

    it("should handle multiple hyphens", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "fix---login---bug",
            },
          },
        ],
      });

      const result = await generateBranchName(mockLlmApi, "Fix the login bug");
      expect(result).toBe("fix-login-bug");
    });

    it("should limit branch name length", async () => {
      const longName = "a".repeat(100);
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: longName,
            },
          },
        ],
      });

      const result = await generateBranchName(mockLlmApi, "Long task");
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it("should fallback to default name on error", async () => {
      mockLlmApi.chatCompletion.mockRejectedValue(new Error("API error"));

      const result = await generateBranchName(mockLlmApi, "Fix bug");
      expect(result).toBe("ai-task");
    });

    it("should handle empty LLM response", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "",
            },
          },
        ],
      });

      const result = await generateBranchName(mockLlmApi, "Fix bug");
      expect(result).toBe("ai-generated-branch");
    });
  });

  describe("generateBranchNameWithSuffix", () => {
    it("should append 4-digit random suffix", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "fix-login-bug",
            },
          },
        ],
      });

      const result = await generateBranchNameWithSuffix(
        mockLlmApi,
        "Fix the login bug",
      );
      expect(result).toMatch(/^fix-login-bug-\d{4}$/);
    });

    it("should generate different suffixes on multiple calls", async () => {
      mockLlmApi.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: "test-branch",
            },
          },
        ],
      });

      const result1 = await generateBranchNameWithSuffix(mockLlmApi, "Test");
      const result2 = await generateBranchNameWithSuffix(mockLlmApi, "Test");

      // While it's theoretically possible for these to be the same,
      // it's extremely unlikely with a 9000 range
      expect(result1).not.toBe(result2);
    });
  });
});
