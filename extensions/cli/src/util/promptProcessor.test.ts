import { beforeEach, describe, expect, it, vi } from "vitest";

import { processRule } from "../hubLoader.js";

import { prependPrompt, processAndCombinePrompts } from "./promptProcessor.js";

// Mock the args module
vi.mock("../hubLoader.js", () => ({
  processRule: vi.fn(),
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
      const mockProcessPromptOrRule = vi.mocked(processRule);
      mockProcessPromptOrRule.mockResolvedValue("processed prompt");

      const result = await processAndCombinePrompts(["prompt1"]);

      expect(mockProcessPromptOrRule).toHaveBeenCalledWith("prompt1");
      expect(result).toBe("processed prompt");
    });

    it("should combine multiple processed prompts", async () => {
      const mockProcessPromptOrRule = vi.mocked(processRule);
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
      const mockProcessPromptOrRule = vi.mocked(processRule);
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
      const mockProcessPromptOrRule = vi.mocked(processRule);
      mockProcessPromptOrRule
        .mockResolvedValueOnce("success1")
        .mockRejectedValueOnce(new Error("processing failed"))
        .mockResolvedValueOnce("success2");

      const result = await processAndCombinePrompts(["good1", "bad", "good2"]);

      expect(mockProcessPromptOrRule).toHaveBeenCalledTimes(3);
      expect(result).toBe("success1\n\nsuccess2");
    });

    it("should return initial prompt when all processing fails", async () => {
      const mockProcessPromptOrRule = vi.mocked(processRule);
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
      const mockProcessPromptOrRule = vi.mocked(processRule);
      mockProcessPromptOrRule.mockRejectedValue(new Error("processing failed"));

      const result = await processAndCombinePrompts(["bad"]);

      expect(result).toBeUndefined();
    });

    it("should warn when processing fails", async () => {
      const mockProcessPromptOrRule = vi.mocked(processRule);
      mockProcessPromptOrRule.mockRejectedValue(new Error("test error"));

      const { logger } = await import("./logger.js");

      await processAndCombinePrompts(["bad-prompt"]);

      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to process prompt "bad-prompt": test error',
      );
    });
  });
});

describe("prependPrompt", () => {
  describe("normal cases", () => {
    it("should combine two non-empty strings with double newlines", () => {
      const result = prependPrompt("Hello", "World");
      expect(result).toBe("Hello\n\nWorld");
    });

    it("should combine multi-line strings correctly", () => {
      const prepend = "Line 1\nLine 2";
      const original = "Line 3\nLine 4";
      const result = prependPrompt(prepend, original);
      expect(result).toBe("Line 1\nLine 2\n\nLine 3\nLine 4");
    });

    it("should handle strings with special characters", () => {
      const prepend = "Special: @#$%^&*()";
      const original = "Unicode: 🚀 ∑ ∆";
      const result = prependPrompt(prepend, original);
      expect(result).toBe("Special: @#$%^&*()\n\nUnicode: 🚀 ∑ ∆");
    });
  });

  describe("undefined parameter cases", () => {
    it("should handle undefined prepend with defined original", () => {
      const result = prependPrompt(undefined, "original");
      expect(result).toBe("original");
    });

    it("should handle defined prepend with undefined original", () => {
      const result = prependPrompt("prepend", undefined);
      expect(result).toBe("prepend");
    });

    it("should return undefined when both parameters are undefined", () => {
      const result = prependPrompt(undefined, undefined);
      expect(result).toBeUndefined();
    });
  });

  describe("empty string cases", () => {
    it("should handle empty prepend with non-empty original", () => {
      const result = prependPrompt("", "original");
      expect(result).toBe("original");
    });

    it("should handle non-empty prepend with empty original", () => {
      const result = prependPrompt("prepend", "");
      expect(result).toBe("prepend");
    });

    it("should return undefined when both parameters are empty strings", () => {
      const result = prependPrompt("", "");
      expect(result).toBeUndefined();
    });

    it("should handle mixed undefined and empty string", () => {
      const result1 = prependPrompt(undefined, "");
      const result2 = prependPrompt("", undefined);
      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe("whitespace cases", () => {
    it("should trim leading and trailing whitespace", () => {
      const result = prependPrompt("  hello  ", "  world  ");
      expect(result).toBe("hello\n\nworld");
    });

    it("should return undefined when result is only whitespace", () => {
      const result = prependPrompt("   ", "   ");
      expect(result).toBeUndefined();
    });

    it("should handle newlines in parameters", () => {
      const prepend = "\nhello\n";
      const original = "\nworld\n";
      const result = prependPrompt(prepend, original);
      expect(result).toBe("hello\n\nworld");
    });

    it("should handle mixed whitespace characters", () => {
      const prepend = "\t  hello  \t";
      const original = "\r\n  world  \r\n";
      const result = prependPrompt(prepend, original);
      expect(result).toBe("hello\n\nworld");
    });

    it("should preserve internal whitespace and newlines", () => {
      const prepend = "hello\n  world";
      const original = "foo\t\tbar";
      const result = prependPrompt(prepend, original);
      expect(result).toBe("hello\n  world\n\nfoo\t\tbar");
    });
  });

  describe("edge cases", () => {
    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const result = prependPrompt(longString, "short");
      expect(result).toBe(`${longString}\n\nshort`);
      expect(result?.length).toBe(10000 + 2 + 5); // long + \n\n + short
    });

    it("should handle strings with only newlines", () => {
      const result = prependPrompt("\n\n\n", "\n\n");
      expect(result).toBeUndefined();
    });

    it("should handle one parameter with content and other with only whitespace", () => {
      const result1 = prependPrompt("content", "   \n  ");
      const result2 = prependPrompt("  \t  ", "content");
      expect(result1).toBe("content");
      expect(result2).toBe("content");
    });
  });

  describe("boundary conditions", () => {
    it("should return undefined for whitespace-only result after trim", () => {
      const cases = [
        ["", ""],
        ["   ", ""],
        ["", "   "],
        ["   ", "   "],
        ["\n", "\n"],
        ["\t", "\r"],
        [undefined, ""],
        ["", undefined],
        [undefined, undefined],
        ["  \n  ", "  \n  "],
      ] as const;

      cases.forEach(([prepend, original]) => {
        const result = prependPrompt(prepend, original);
        expect(result).toBeUndefined();
      });
    });

    it("should return trimmed string for non-empty result", () => {
      const cases = [
        ["a", "", "a"],
        ["", "b", "b"],
        ["a", "b", "a\n\nb"],
        ["  a  ", "", "a"],
        ["", "  b  ", "b"],
        ["  a  ", "  b  ", "a\n\nb"],
        [undefined, "content", "content"],
        ["content", undefined, "content"],
      ] as const;

      cases.forEach(([prepend, original, expected]) => {
        const result = prependPrompt(prepend, original);
        expect(result).toBe(expected);
      });
    });
  });

  describe("return type consistency", () => {
    it("should always return string or undefined", () => {
      const testCases = [
        ["hello", "world"],
        [undefined, "world"],
        ["hello", undefined],
        [undefined, undefined],
        ["", ""],
        ["   ", "   "],
      ] as const;

      testCases.forEach(([prepend, original]) => {
        const result = prependPrompt(prepend, original);
        expect(typeof result === "string" || result === undefined).toBe(true);
      });
    });
  });
});
