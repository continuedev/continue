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

/**
 * Titles of the models a mode offers (default first), from `modeModels.<mode>.models`.
 * Undefined means the mode has no list, so every model is offered as before.
 */
export function getModeModelTitles(
  config: ModeModelsInput,
  mode: MessageModes,
): string[] | undefined {
  if (mode === "background") return undefined;
  const titles = config.modeModels?.[mode]?.titles;
  return titles && titles.length > 0 ? titles : undefined;
}

/**
 * Split picker options into those the mode offers (in the configured order,
 * default first) and the rest (original order). Titles with no matching option
 * are skipped. With no list, everything is "rest".
 */
export function partitionModelsByMode<T extends { value: string }>(
  options: T[],
  titles: string[] | undefined,
): { offered: T[]; rest: T[] } {
  if (!titles) return { offered: [], rest: options };
  const offered: T[] = [];
  for (const title of titles) {
    const option = options.find((o) => o.value === title);
    if (option && !offered.includes(option)) offered.push(option);
  }
  return { offered, rest: options.filter((o) => !offered.includes(o)) };
}

/**
 * The model after `current` in `candidates`, wrapping around. When `current`
 * is not a candidate (for example a model picked by hand that the mode does not
 * offer) the first candidate is chosen going forward, the last going back.
 */
export function nextModelTitle(
  candidates: { value: string }[],
  current: string | undefined,
  direction: 1 | -1 = 1,
): string | undefined {
  if (candidates.length === 0) return undefined;
  const index = candidates.findIndex((c) => c.value === current);
  const next =
    index === -1
      ? direction === 1
        ? 0
        : candidates.length - 1
      : (index + direction + candidates.length) % candidates.length;
  return candidates[next].value;
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
