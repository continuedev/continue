import { describe, expect, it } from "vitest";

import CrossModel from "./CrossModel";

describe("CrossModel", () => {
  it("should have correct provider name", () => {
    expect(CrossModel.providerName).toBe("crossmodel");
  });

  it("should have correct default options", () => {
    expect(CrossModel.defaultOptions.apiBase).toBe(
      "https://api.crossmodel.ai/v1/",
    );
    expect(CrossModel.defaultOptions.useLegacyCompletionsEndpoint).toBe(false);
  });

  it("should support reasoning fields", () => {
    const crossModel = new CrossModel({
      model: "anthropic/claude-sonnet-4-6",
    });

    expect(crossModel["supportsReasoningField"]).toBe(true);
    expect(crossModel["supportsReasoningDetailsField"]).toBe(true);
  });

  it("should preserve the configured model id", () => {
    const models = [
      "anthropic/claude-opus-4-8",
      "openai/gpt-5.5",
      "deepseek/deepseek-v4-pro",
    ];

    for (const model of models) {
      const crossModel = new CrossModel({ model });
      expect(crossModel.model).toBe(model);
    }
  });
});
