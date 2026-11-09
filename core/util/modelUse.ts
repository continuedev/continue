import type {
  LoopItemModel,
  ModeModelSetting,
  ModeModelsConfig,
  ModelUse,
} from "..";
import {
  findConfiguredModel,
  type ModelCandidate,
} from "../subagents/model.js";

/**
 * Which model does what. Pure helpers over the resolved `modeModels`, shared
 * by core, the GUI and the CLI, so every surface falls back the same way.
 * Design: plans/policy-areas.md ("The reviewer model") and docs/reference.mdx.
 */

/** Every use, in the order settings show them. */
export const MODEL_USES = [
  "chat",
  "plan",
  "agent",
  "loop",
  "replan",
  "subagent",
  "reviewer",
] as const;

/** The uses with a model picker, where a `models` list makes sense. */
export const PICKER_USES = ["chat", "plan", "agent"] as const;
export type PickerUse = (typeof PICKER_USES)[number];

/** A use with no entry of its own takes this one's model. */
export const USE_FALLBACK: Partial<Record<ModelUse, ModelUse>> = {
  loop: "agent",
  replan: "plan",
};

/**
 * The entry for a use: its own, else its fallback's (`loop` → `agent`,
 * `replan` → `plan`). Undefined when neither is set: `subagent` then means
 * the parent turn's model, `reviewer` the model selected for that role, and a
 * mode keeps whichever model is selected.
 */
export function modeModelFor(
  modeModels: ModeModelsConfig | undefined,
  use: ModelUse,
): ModeModelSetting | undefined {
  if (!modeModels) return undefined;
  const own = modeModels[use];
  if (own) return own;
  const fallback = USE_FALLBACK[use];
  return fallback ? modeModels[fallback] : undefined;
}

/** The use a Loop turn is: items act, everything else re-plans. */
export function useForLoopTurn(kind: "item" | "replan" | "check"): ModelUse {
  return kind === "item" ? "loop" : "replan";
}

export interface LoopItemModelChoice<M extends ModelCandidate> {
  /** The model the run goes to; undefined keeps whichever is selected */
  model?: M;
  /** What the item's run records when it names a model (LoopItemState.model) */
  record?: LoopItemModel;
}

/**
 * The chat model an item's run goes to. An item that names one
 * (`TaskItem.model`, by the model's name) gets it, resolved against the
 * configured chat models the way a subagent's model is (title, id, then a
 * family alias); a name that is not configured falls back to `loopModel`,
 * the model `modeModels.loop` gives the loop (or the selected one), with the
 * reason in `record`. An item that names none gets `loopModel` and records
 * nothing. Everything else about the turn (prompt, reasoning effort) stays
 * the loop entry's.
 */
export function modelForLoopItem<M extends ModelCandidate>(
  item: { model?: string } | undefined,
  chatModels: M[],
  loopModel: M | undefined,
): LoopItemModelChoice<M> {
  const requested = item?.model?.trim();
  if (!requested) return { model: loopModel };
  const found = findConfiguredModel(requested, chatModels, loopModel);
  if (found) return { model: found, record: { title: found.title } };
  const fallbackTitle = loopModel?.title ?? "the selected model";
  return {
    model: loopModel,
    record: {
      title: fallbackTitle,
      fallbackReason: `model "${requested}" is not configured; using ${fallbackTitle}`,
    },
  };
}

/** Thinking budget (tokens) each reasoning effort maps to. */
export const REASONING_EFFORT_BUDGET_TOKENS = {
  low: 1024,
  medium: 4096,
  high: 16384,
} as const;

export type ReasoningEffort =
  "off" | keyof typeof REASONING_EFFORT_BUDGET_TOKENS;

/**
 * Completion-option fields for a reasoning effort. Undefined when none is set,
 * so the model's own defaults apply.
 */
export function reasoningOptionsForEffort(
  effort: ReasoningEffort | undefined,
): { reasoning: boolean; reasoningBudgetTokens?: number } | undefined {
  if (!effort) return undefined;
  if (effort === "off") return { reasoning: false };
  return {
    reasoning: true,
    reasoningBudgetTokens: REASONING_EFFORT_BUDGET_TOKENS[effort],
  };
}
