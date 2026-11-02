import { describe, expect, test } from "vitest";
import {
  budgetTokensToEffort,
  getAnthropicThinkingParams,
  supportsAdaptiveThinking,
} from "./anthropicThinking.js";

describe("supportsAdaptiveThinking", () => {
  test.each([
    "claude-sonnet-4-6",
    "claude-opus-4-6",
    "claude-sonnet-4-7",
    "claude-opus-5",
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-haiku-5-5",
    "claude-fable-5-1",
    "anthropic.claude-haiku-5-5",
    "us.anthropic.claude-opus-5-5",
  ])("%s uses adaptive thinking", (model) => {
    expect(supportsAdaptiveThinking(model)).toBe(true);
  });

  test.each([
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20240620",
    "gpt-4o",
  ])("%s keeps enabled thinking", (model) => {
    expect(supportsAdaptiveThinking(model)).toBe(false);
  });
});

describe("budgetTokensToEffort", () => {
  test("maps GUI budgets to effort levels", () => {
    expect(budgetTokensToEffort(1024)).toBe("low");
    expect(budgetTokensToEffort(4096)).toBe("medium");
    expect(budgetTokensToEffort(16384)).toBe("high");
  });
});

describe("getAnthropicThinkingParams", () => {
  test("returns no thinking fields when reasoning is off", () => {
    expect(
      getAnthropicThinkingParams({ model: "claude-sonnet-4-6" } as any),
    ).toEqual({});
  });

  test("uses adaptive thinking with effort for newer models", () => {
    expect(
      getAnthropicThinkingParams({
        model: "claude-sonnet-4-6",
        reasoning: true,
        reasoningBudgetTokens: 4096,
      } as any),
    ).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
  });

  test("keeps enabled thinking with budget for older models", () => {
    expect(
      getAnthropicThinkingParams({
        model: "claude-sonnet-4-20250514",
        reasoning: true,
        reasoningBudgetTokens: 2048,
      } as any),
    ).toEqual({
      thinking: { type: "enabled", budget_tokens: 2048 },
    });
  });
});
