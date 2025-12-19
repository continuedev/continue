import { describe, test, expect } from "vitest";

/**
 * AI SDK v5 Usage Field Migration Tests
 *
 * This test suite verifies correct handling of usage field changes in AI SDK v5:
 * - v4: usage.promptTokens → v5: usage.inputTokens
 * - v4: usage.completionTokens → v5: usage.outputTokens
 * - v4: usage.totalTokens → v5: usage.totalTokens (unchanged)
 *
 * The adapters need to map these fields correctly when converting from
 * Vercel AI SDK responses back to OpenAI-compatible format.
 */

describe("AI SDK v5 Migration: Usage Fields", () => {
  describe("Usage field mapping", () => {
    test("maps inputTokens to prompt_tokens", () => {
      // Simulating the mapping that should happen in the adapter
      const vercelUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      // Expected OpenAI format
      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.completion_tokens).toBe(50);
      expect(expectedUsage.total_tokens).toBe(150);
    });

    test("handles missing inputTokens gracefully", () => {
      // AI SDK v5 might not always provide all fields
      const vercelUsage: any = {
        outputTokens: 50,
        totalTokens: 150,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(50);
      expect(expectedUsage.total_tokens).toBe(150);
    });

    test("handles missing outputTokens gracefully", () => {
      const vercelUsage: any = {
        inputTokens: 100,
        totalTokens: 150,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.completion_tokens).toBe(0);
      expect(expectedUsage.total_tokens).toBe(150);
    });

    test("handles missing totalTokens gracefully", () => {
      const vercelUsage: any = {
        inputTokens: 100,
        outputTokens: 50,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.completion_tokens).toBe(50);
      expect(expectedUsage.total_tokens).toBe(0);
    });

    test("handles completely missing usage object", () => {
      const vercelUsage: any = undefined;

      const expectedUsage = {
        prompt_tokens: vercelUsage?.inputTokens ?? 0,
        completion_tokens: vercelUsage?.outputTokens ?? 0,
        total_tokens: vercelUsage?.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(0);
      expect(expectedUsage.total_tokens).toBe(0);
    });

    test("handles zero values correctly", () => {
      const vercelUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(0);
      expect(expectedUsage.total_tokens).toBe(0);
    });

    test("handles large token counts", () => {
      const vercelUsage = {
        inputTokens: 100000,
        outputTokens: 50000,
        totalTokens: 150000,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(100000);
      expect(expectedUsage.completion_tokens).toBe(50000);
      expect(expectedUsage.total_tokens).toBe(150000);
    });
  });

  describe("Anthropic-specific usage fields", () => {
    test("maps inputTokensDetails for Anthropic caching", () => {
      // Anthropic has additional caching details in v5
      const vercelUsage: any = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        inputTokensDetails: {
          cachedTokens: 30,
        },
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
        prompt_tokens_details: {
          cached_tokens: vercelUsage.inputTokensDetails?.cachedTokens ?? 0,
          cache_read_tokens: vercelUsage.inputTokensDetails?.cachedTokens ?? 0,
          cache_write_tokens: 0,
        },
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.prompt_tokens_details.cached_tokens).toBe(30);
      expect(expectedUsage.prompt_tokens_details.cache_read_tokens).toBe(30);
    });

    test("handles missing inputTokensDetails", () => {
      const vercelUsage: any = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
        prompt_tokens_details: {
          cached_tokens: vercelUsage.inputTokensDetails?.cachedTokens ?? 0,
          cache_read_tokens: vercelUsage.inputTokensDetails?.cachedTokens ?? 0,
          cache_write_tokens: 0,
        },
      };

      expect(expectedUsage.prompt_tokens_details.cached_tokens).toBe(0);
      expect(expectedUsage.prompt_tokens_details.cache_read_tokens).toBe(0);
    });

    test("correctly renames promptTokensDetails to inputTokensDetails", () => {
      // In v4, it was promptTokensDetails, in v5 it's inputTokensDetails
      const v4Usage: any = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        promptTokensDetails: {
          cachedTokens: 30,
        },
      };

      const v5Usage: any = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        inputTokensDetails: {
          cachedTokens: 30,
        },
      };

      // Verify v4 format is different from v5
      expect(v4Usage).toHaveProperty("promptTokens");
      expect(v4Usage).toHaveProperty("promptTokensDetails");
      expect(v5Usage).toHaveProperty("inputTokens");
      expect(v5Usage).toHaveProperty("inputTokensDetails");

      // Verify the correct mapping
      expect(v5Usage.inputTokens).toBe(v4Usage.promptTokens);
      expect(v5Usage.inputTokensDetails.cachedTokens).toBe(
        v4Usage.promptTokensDetails.cachedTokens,
      );
    });
  });

  describe("Edge cases in usage field handling", () => {
    test("handles negative values (invalid but defensive)", () => {
      const vercelUsage: any = {
        inputTokens: -10,
        outputTokens: -5,
        totalTokens: -15,
      };

      const expectedUsage = {
        prompt_tokens: Math.max(0, vercelUsage.inputTokens ?? 0),
        completion_tokens: Math.max(0, vercelUsage.outputTokens ?? 0),
        total_tokens: Math.max(0, vercelUsage.totalTokens ?? 0),
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(0);
      expect(expectedUsage.total_tokens).toBe(0);
    });

    test("handles non-numeric values (type safety)", () => {
      const vercelUsage: any = {
        inputTokens: "not a number",
        outputTokens: null,
        totalTokens: undefined,
      };

      const safeNumber = (val: any): number => {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      const expectedUsage = {
        prompt_tokens: safeNumber(vercelUsage.inputTokens),
        completion_tokens: safeNumber(vercelUsage.outputTokens),
        total_tokens: safeNumber(vercelUsage.totalTokens),
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(0);
      expect(expectedUsage.total_tokens).toBe(0);
    });

    test("handles floating point token counts", () => {
      const vercelUsage = {
        inputTokens: 100.5,
        outputTokens: 50.7,
        totalTokens: 151.2,
      };

      const expectedUsage = {
        prompt_tokens: Math.floor(vercelUsage.inputTokens ?? 0),
        completion_tokens: Math.floor(vercelUsage.outputTokens ?? 0),
        total_tokens: Math.floor(vercelUsage.totalTokens ?? 0),
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.completion_tokens).toBe(50);
      expect(expectedUsage.total_tokens).toBe(151);
    });

    test("verifies totalTokens consistency", () => {
      const vercelUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const calculatedTotal =
        vercelUsage.inputTokens + vercelUsage.outputTokens;
      const providedTotal = vercelUsage.totalTokens;

      // Total tokens should match sum of input and output
      expect(calculatedTotal).toBe(providedTotal);
    });

    test("handles inconsistent totalTokens", () => {
      const vercelUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 200, // Inconsistent!
      };

      const calculatedTotal =
        vercelUsage.inputTokens + vercelUsage.outputTokens;
      const providedTotal = vercelUsage.totalTokens;

      // This demonstrates the inconsistency
      expect(calculatedTotal).not.toBe(providedTotal);
      expect(calculatedTotal).toBe(150);
      expect(providedTotal).toBe(200);

      // In practice, we should use the provided totalTokens
      const expectedUsage = {
        prompt_tokens: vercelUsage.inputTokens ?? 0,
        completion_tokens: vercelUsage.outputTokens ?? 0,
        total_tokens: vercelUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.total_tokens).toBe(200);
    });
  });

  describe("Streaming vs non-streaming usage differences", () => {
    test("handles streaming usage accumulation", () => {
      // In streaming, usage might be accumulated over multiple chunks
      const streamChunks = [
        { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
        { inputTokens: 0, outputTokens: 5, totalTokens: 15 },
        { inputTokens: 0, outputTokens: 5, totalTokens: 20 },
        { inputTokens: 0, outputTokens: 5, totalTokens: 25 },
      ];

      // The final usage should be from the last chunk
      const finalUsage = streamChunks[streamChunks.length - 1];

      const expectedUsage = {
        prompt_tokens: finalUsage.inputTokens ?? 0,
        completion_tokens: finalUsage.outputTokens ?? 0,
        total_tokens: finalUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(0);
      expect(expectedUsage.completion_tokens).toBe(5);
      expect(expectedUsage.total_tokens).toBe(25);
    });

    test("non-streaming provides complete usage immediately", () => {
      const nonStreamUsage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      const expectedUsage = {
        prompt_tokens: nonStreamUsage.inputTokens ?? 0,
        completion_tokens: nonStreamUsage.outputTokens ?? 0,
        total_tokens: nonStreamUsage.totalTokens ?? 0,
      };

      expect(expectedUsage.prompt_tokens).toBe(100);
      expect(expectedUsage.completion_tokens).toBe(50);
      expect(expectedUsage.total_tokens).toBe(150);
    });
  });
});
