import { ILLM } from "..";
import { applyCodeBlock } from "./applyCodeBlock";

describe("applyCodeBlock", () => {
  const mockLLM = {
    providerName: "test",
    model: "test-model",
    streamComplete: jest.fn(),
    streamChat: jest.fn(),
  } as unknown as ILLM;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Undefined Generation Failure Handling", () => {
    test("should log warning when bypassing deterministic approach due to undefined input", async () => {
      const abortController = new AbortController();

      // Spy on console methods to capture the warning messages
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      try {
        const result = await applyCodeBlock(
          "const test = 'original';",
          undefined as any, // This will trigger the bypass
          "test.ts",
          mockLLM,
          abortController,
        );

        // Should fall back to streaming approach (not instant apply)
        expect(result.isInstantApply).toBe(false);

        // Should have logged the warning messages
        expect(warnSpy).toHaveBeenCalledWith(
          "Deterministic lazy edit bypassed for test.ts. Falling back to streaming approach.",
        );
        expect(warnSpy).toHaveBeenCalledWith(
          "Full lazy apply context:",
          expect.stringContaining("Deterministic approach returned undefined"),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    test("should handle valid input that bypasses deterministic approach", async () => {
      const abortController = new AbortController();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      try {
        const result = await applyCodeBlock(
          "const test = 'original';",
          "const test = 'updated';", // Valid input that may still bypass
          "test.ts",
          mockLLM,
          abortController,
        );

        expect(result).toBeDefined();
        expect(result.diffLinesGenerator).toBeDefined();

        // May or may not bypass depending on deterministic logic
        // The important thing is that it doesn't crash
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe("Valid Input Handling", () => {
    test("should use instant apply for supported file types with valid input", async () => {
      const abortController = new AbortController();

      const result = await applyCodeBlock(
        "const oldVar = 'test';",
        "const newVar = 'updated';",
        "test.ts",
        mockLLM,
        abortController,
      );

      // For valid TypeScript content, should attempt instant apply
      // Note: The actual result depends on the deterministic logic, but we're testing the flow
      expect(result).toBeDefined();
      expect(result.diffLinesGenerator).toBeDefined();
    });

    test("should fall back to streaming for unsupported file types", async () => {
      const abortController = new AbortController();

      const result = await applyCodeBlock(
        "Some content",
        "Updated content",
        "test.unsupported",
        mockLLM,
        abortController,
      );

      // Should fall back to streaming approach for unsupported file types
      expect(result.isInstantApply).toBe(false);
      expect(result.diffLinesGenerator).toBeDefined();
    });
  });

  describe("Unified Diff Handling", () => {
    test("should handle unified diff format", async () => {
      const abortController = new AbortController();
      const errorSpy = jest.spyOn(console, "error").mockImplementation();

      try {
        const unifiedDiff = `--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-const oldVar = 'test';
+const newVar = 'updated';`;

        const result = await applyCodeBlock(
          "const oldVar = 'test';",
          unifiedDiff,
          "test.ts",
          mockLLM,
          abortController,
        );

        expect(result).toBeDefined();
        expect(result.diffLinesGenerator).toBeDefined();
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});
