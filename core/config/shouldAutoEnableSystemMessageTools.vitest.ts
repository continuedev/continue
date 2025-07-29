import { describe, expect, test } from "vitest";
import { ModelDescription } from "../index.d";
import { shouldAutoEnableSystemMessageTools } from "./shouldAutoEnableSystemMessageTools";

describe("shouldAutoEnableSystemMessageTools", () => {
  const createModel = (provider: string, model: string): ModelDescription => ({
    title: "Test Model",
    provider,
    underlyingProviderName: provider,
    model,
  });

  test("should return true for OpenRouter models that don't contain 'claude'", () => {
    expect(
      shouldAutoEnableSystemMessageTools(createModel("openrouter", "gpt-4o")),
    ).toBe(true);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "llama-3.3-70b-instruct"),
      ),
    ).toBe(true);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "qwen/qwen-2.5-72b-instruct"),
      ),
    ).toBe(true);
  });

  test("should return false for OpenRouter Claude models", () => {
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "anthropic/claude-3-sonnet"),
      ),
    ).toBe(false);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "anthropic/claude-3.5-sonnet"),
      ),
    ).toBe(false);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "claude-3-haiku"),
      ),
    ).toBe(false);
  });

  test("should return undefined for all other providers", () => {
    expect(
      shouldAutoEnableSystemMessageTools(createModel("openai", "gpt-4o")),
    ).toBe(undefined);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("anthropic", "claude-3.5-sonnet"),
      ),
    ).toBe(undefined);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("groq", "llama-3.3-70b-versatile"),
      ),
    ).toBe(undefined);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("together", "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"),
      ),
    ).toBe(undefined);
  });

  test("should be case insensitive for 'claude' detection", () => {
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "CLAUDE-models"),
      ),
    ).toBe(false);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "Claude-3.5"),
      ),
    ).toBe(false);
    expect(
      shouldAutoEnableSystemMessageTools(
        createModel("openrouter", "some-model-Claude"),
      ),
    ).toBe(false);
  });
});
