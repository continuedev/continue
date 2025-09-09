import { describe, it, expect, vi, beforeEach } from "vitest";

import * as args from "../args.js";

import { processAndCombinePrompts } from "./promptProcessor.js";

// Mock the args module
vi.mock("../args.js", () => ({
  processPromptOrRule: vi.fn(),
}));

// Mock the logger
vi.mock("./logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("promptProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processAndCombinePrompts", () => {
    it("should return initial prompt when no additional prompts", async () => {
      const result = await processAndCombinePrompts(undefined, "initial");
      expect(result).toBe("initial");
    });

    it("should return initial prompt when empty additional prompts array", async () => {
      const result = await processAndCombinePrompts([], "initial");
      expect(result).toBe("initial");
    });

    it("should return undefined when no prompts at all", async () => {
      const result = await processAndCombinePrompts();
      expect(result).toBeUndefined();
    });

    it("should process single additional prompt without initial", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule.mockResolvedValue("processed prompt");

      const result = await processAndCombinePrompts(["prompt1"]);

      expect(mockProcessPromptOrRule).toHaveBeenCalledWith("prompt1");
      expect(result).toBe("processed prompt");
    });

    it("should combine multiple processed prompts", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule
        .mockResolvedValueOnce("first prompt")
        .mockResolvedValueOnce("second prompt");

      const result = await processAndCombinePrompts(["prompt1", "prompt2"]);

      expect(mockProcessPromptOrRule).toHaveBeenCalledTimes(2);
      expect(mockProcessPromptOrRule).toHaveBeenNthCalledWith(1, "prompt1");
      expect(mockProcessPromptOrRule).toHaveBeenNthCalledWith(2, "prompt2");
      expect(result).toBe("first prompt\n\nsecond prompt");
    });

    it("should combine processed prompts with initial prompt", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule
        .mockResolvedValueOnce("processed1")
        .mockResolvedValueOnce("processed2");

      const result = await processAndCombinePrompts(
        ["prompt1", "prompt2"],
        "initial",
      );

      expect(result).toBe("processed1\n\nprocessed2\n\ninitial");
    });

    it("should handle processing errors and continue with successful ones", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule
        .mockResolvedValueOnce("success1")
        .mockRejectedValueOnce(new Error("processing failed"))
        .mockResolvedValueOnce("success2");

      const result = await processAndCombinePrompts(["good1", "bad", "good2"]);

      expect(mockProcessPromptOrRule).toHaveBeenCalledTimes(3);
      expect(result).toBe("success1\n\nsuccess2");
    });

    it("should return initial prompt when all processing fails", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule
        .mockRejectedValueOnce(new Error("fail1"))
        .mockRejectedValueOnce(new Error("fail2"));

      const result = await processAndCombinePrompts(
        ["bad1", "bad2"],
        "initial",
      );

      expect(result).toBe("initial");
    });

    it("should return undefined when all processing fails and no initial", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule.mockRejectedValue(new Error("processing failed"));

      const result = await processAndCombinePrompts(["bad"]);

      expect(result).toBeUndefined();
    });

    it("should warn when processing fails", async () => {
      const mockProcessPromptOrRule = vi.mocked(args.processPromptOrRule);
      mockProcessPromptOrRule.mockRejectedValue(new Error("test error"));

      const { logger } = await import("./logger.js");

      await processAndCombinePrompts(["bad-prompt"]);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to process prompt "bad-prompt": test error',
      );
    });
  });
});
