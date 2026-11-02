import { CompletionOptions } from "../../index.js";
import { DEFAULT_REASONING_TOKENS } from "../constants.js";

export type AnthropicEffort = "low" | "medium" | "high";

export interface AnthropicThinkingParams {
  thinking?: { type: "enabled"; budget_tokens: number } | { type: "adaptive" };
  output_config?: { effort: AnthropicEffort };
}

// Models that reject `thinking.type: "enabled"` and instead require
// `thinking.type: "adaptive"` with `output_config.effort`.
const ADAPTIVE_THINKING_MODEL_PATTERN =
  /claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/;

export function supportsAdaptiveThinking(model: string): boolean {
  return ADAPTIVE_THINKING_MODEL_PATTERN.test(model);
}

// Inverse of the GUI mapping in gui/src/util/modeModels.ts
// (low: 1024, medium: 4096, high: 16384).
export function budgetTokensToEffort(budgetTokens: number): AnthropicEffort {
  if (budgetTokens <= 1024) {
    return "low";
  }
  if (budgetTokens <= 4096) {
    return "medium";
  }
  return "high";
}

export function getAnthropicThinkingParams(
  options: CompletionOptions,
): AnthropicThinkingParams {
  if (!options.reasoning) {
    return {};
  }

  const budgetTokens =
    options.reasoningBudgetTokens ?? DEFAULT_REASONING_TOKENS;

  if (supportsAdaptiveThinking(options.model)) {
    return {
      thinking: { type: "adaptive" },
      output_config: { effort: budgetTokensToEffort(budgetTokens) },
    };
  }

  return {
    thinking: { type: "enabled", budget_tokens: budgetTokens },
  };
}
