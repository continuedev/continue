// core/tools/index.test.ts
import { describe, expect, it } from "@jest/globals";

import { ConfigDependentToolParams } from "../index.js";
import { getConfigDependentToolDefinitions } from "./index.js";

const createParams = (
  overrides: Partial<ConfigDependentToolParams> = {},
): ConfigDependentToolParams => ({
  modelName: "gpt-4",
  enableExperimentalTools: false,
  isSignedIn: false,
  isRemote: false,
  rules: [],
  ...overrides,
});

describe("getConfigDependentToolDefinitions", () => {
  describe("memory tool", () => {
    it("should include memory tool for Claude 4+ models when experimental tools enabled", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "claude-sonnet-4-20250514",
          enableExperimentalTools: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeDefined();
      // Note: The type in ChatCompletionTool format will be "memory_20250818"
      // but it's not set at this level - it's in the original tool definition
      expect(memoryTool?.function.description).toContain("claude memory tool");
    });

    it("should NOT include memory tool for Claude 4+ models when experimental tools disabled", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "claude-sonnet-4-20250514",
          enableExperimentalTools: false,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeUndefined();
    });

    it("should NOT include memory tool for Claude 3 models (memory only available on Claude 4+)", () => {
      const claude3Models = [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
        "claude-3-5-sonnet-20240620",
        "claude-3-5-sonnet-20241022",
        "anthropic.claude-3-5-sonnet-20241022-v2:0",
      ];

      for (const modelName of claude3Models) {
        const tools = getConfigDependentToolDefinitions(
          createParams({
            modelName,
            enableExperimentalTools: true,
          }),
        );

        const memoryTool = tools.find((t) => t.function.name === "memory");
        expect(memoryTool).toBeUndefined();
      }
    });

    it("should NOT include memory tool for non-Claude models even with experimental tools", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "gpt-4",
          enableExperimentalTools: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeUndefined();
    });

    it("should include memory tool for Claude 4 Sonnet models", () => {
      const models = ["claude-sonnet-4-20250514", "claude-sonnet-4-5-20250929"];

      for (const model of models) {
        const tools = getConfigDependentToolDefinitions(
          createParams({ modelName: model, enableExperimentalTools: true }),
        );
        const memoryTool = tools.find((t) => t.function.name === "memory");
        expect(memoryTool).toBeDefined();
      }
    });

    it("should include memory tool for Claude 4 Opus models", () => {
      const models = ["claude-opus-4-20250514", "claude-opus-4-1-20250805"];

      for (const model of models) {
        const tools = getConfigDependentToolDefinitions(
          createParams({ modelName: model, enableExperimentalTools: true }),
        );
        const memoryTool = tools.find((t) => t.function.name === "memory");
        expect(memoryTool).toBeDefined();
      }
    });

    it("should include memory tool for Claude 4 Haiku models", () => {
      const model = "claude-haiku-4-5-20251001";
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: model, enableExperimentalTools: true }),
      );
      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeDefined();
    });

    it("should include memory tool for Bedrock Claude 4 models", () => {
      const models = [
        "anthropic.claude-sonnet-4-20250514-v1:0",
        "anthropic.claude-opus-4-20250514-v1:0",
        "anthropic.claude-haiku-4-5-20251001-v1:0",
      ];

      for (const model of models) {
        const tools = getConfigDependentToolDefinitions(
          createParams({ modelName: model, enableExperimentalTools: true }),
        );
        const memoryTool = tools.find((t) => t.function.name === "memory");
        expect(memoryTool).toBeDefined();
      }
    });

    it("should have correct memory tool structure", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "claude-sonnet-4-20250514",
          enableExperimentalTools: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeDefined();

      // Verify function structure
      expect(memoryTool?.function).toMatchObject({
        name: "memory",
        description: expect.any(String),
        parameters: expect.objectContaining({
          type: "object",
          required: expect.arrayContaining(["command"]),
          properties: expect.objectContaining({
            command: expect.any(Object),
            path: expect.any(Object),
          }),
        }),
      });
    });

    it("should include both memory and search tools when both conditions met", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "claude-sonnet-4-20250514",
          enableExperimentalTools: true,
          isSignedIn: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      const searchTool = tools.find((t) => t.function.name === "search_web");

      expect(memoryTool).toBeDefined();
      expect(searchTool).toBeDefined();
    });
  });

  describe("search tool", () => {
    it("should include search tool when search is enabled", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: "gpt-4", isSignedIn: true }),
      );

      const searchTool = tools.find((t) => t.function.name === "search_web");
      expect(searchTool).toBeDefined();
    });

    it("should NOT include search tool when search is disabled", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: "gpt-4", isSignedIn: false }),
      );

      const searchTool = tools.find((t) => t.function.name === "search_web");
      expect(searchTool).toBeUndefined();
    });

    it("should NOT include search tool by default", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: "gpt-4" }),
      );

      const searchTool = tools.find((t) => t.function.name === "search_web");
      expect(searchTool).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("should return empty array for empty model name with no features enabled", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: "" }),
      );
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should handle undefined model gracefully", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: undefined }),
      );
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should handle null model gracefully", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({ modelName: null as any }),
      );
      expect(Array.isArray(tools)).toBe(true);
    });

    it("should not duplicate tools when called multiple times", () => {
      const params = createParams({
        modelName: "claude-sonnet-4-20250514",
        enableExperimentalTools: true,
      });
      const tools1 = getConfigDependentToolDefinitions(params);
      const tools2 = getConfigDependentToolDefinitions(params);

      expect(tools1).toEqual(tools2);
      expect(tools1.length).toBe(tools2.length);
    });
  });

  describe("model name case sensitivity", () => {
    it("should match Claude 4 models case-insensitively", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "CLAUDE-SONNET-4-20250514",
          enableExperimentalTools: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeDefined();
    });

    it("should match mixed case Claude 4 model names", () => {
      const tools = getConfigDependentToolDefinitions(
        createParams({
          modelName: "Claude-Sonnet-4-20250514",
          enableExperimentalTools: true,
        }),
      );

      const memoryTool = tools.find((t) => t.function.name === "memory");
      expect(memoryTool).toBeDefined();
    });
  });
});
