import { ModelConfig } from "@continuedev/config-yaml";
import { describe, expect, it } from "vitest";

import { validateContextLength } from "./tokenizer.js";

describe("validateContextLength", () => {
  const createMockModel = (
    contextLength: number,
    maxTokens?: number,
  ): ModelConfig => ({
    name: "test-model",
    model: "test",
    provider: "openai",
    defaultCompletionOptions: {
      contextLength,
      maxTokens,
    },
  });

  const createMockHistory = (messageCount: number, contentLength = 100) => {
    return Array.from({ length: messageCount }, (_, i) => ({
      message: {
        role: "user" as const,
        content: "x".repeat(contentLength), // Roughly contentLength/4 tokens
      },
      contextItems: [],
    }));
  };

  it("should pass validation when within context limits", () => {
    const model = createMockModel(1000, 200);
    const chatHistory = createMockHistory(5, 40); // ~50 tokens total

    const result = validateContextLength({ chatHistory, model });

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should fail validation when input + maxTokens exceeds context limit", () => {
    const model = createMockModel(1000, 800);
    const chatHistory = createMockHistory(20, 100); // ~500+ tokens

    const result = validateContextLength({ chatHistory, model });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Context length exceeded");
    expect(result.error).toContain("input");
    expect(result.error).toContain("max_tokens");
    expect(result.error).toContain("context_limit");
  });

  it("should handle large models with appropriate scaling", () => {
    const model = createMockModel(200_000, 64_000); // Claude-like model
    const chatHistory = createMockHistory(100, 1000); // Large conversation

    const result = validateContextLength({ chatHistory, model });

    expect(result.contextLimit).toBe(200_000);
    expect(result.maxTokens).toBe(64_000);
  });
});
