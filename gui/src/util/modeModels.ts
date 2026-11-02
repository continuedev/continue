import type {
  BrowserSerializedContinueConfig,
  MessageModes,
  ModeReasoningEffort,
} from "core";

/** Thinking budget (tokens) each reasoning effort maps to. */
export const REASONING_EFFORT_BUDGET_TOKENS = {
  low: 1024,
  medium: 4096,
  high: 16384,
} as const;

type ModeModelsInput = Pick<BrowserSerializedContinueConfig, "modeModels">;

/**
 * Title of the chat model a mode should use: the user's manual pick for that
 * mode if there is one, otherwise the `modeModels` entry, otherwise undefined
 * (the current model is kept).
 */
export function getModeModelTitle(
  config: ModeModelsInput,
  mode: MessageModes,
  overrides: Partial<Record<MessageModes, string>> = {},
): string | undefined {
  if (mode === "background") return undefined;
  return overrides[mode] ?? config.modeModels?.[mode]?.title;
}

/** Reasoning effort configured for a mode, if any. */
export function getModeReasoningEffort(
  config: ModeModelsInput,
  mode: MessageModes,
): ModeReasoningEffort | undefined {
  if (mode === "background") return undefined;
  return config.modeModels?.[mode]?.reasoningEffort;
}

/**
 * Completion-option fields for a mode's reasoning effort. Returns undefined
 * when the mode sets none.
 */
export function reasoningOptionsForEffort(
  effort: ModeReasoningEffort | undefined,
): { reasoning: boolean; reasoningBudgetTokens?: number } | undefined {
  if (!effort) return undefined;
  if (effort === "off") return { reasoning: false };
  return {
    reasoning: true,
    reasoningBudgetTokens: REASONING_EFFORT_BUDGET_TOKENS[effort],
  };
}
