import { ModelConfig } from "@continuedev/config-yaml";

import { getModelContextLimit } from "./util/tokenizer.js";

/**
 * Kind of chat request, for `contextManagement.requestBodyHints`.
 * - "conversation": a turn that later turns continue (main chat, sub-agents)
 * - "oneShot": a side request that nothing continues (the compaction summary)
 */
export type RequestKind = "conversation" | "oneShot";

/**
 * Extra body fields a model's config asks for on a given kind of request.
 * Used for server-side prompt cache hints, e.g. Strata's
 * `{"strata_checkpoint": false}` on one-shot requests so they do not evict the
 * main conversation from a single-slot cache. Empty unless configured.
 */
export function getRequestBodyHints(
  model: ModelConfig,
  kind: RequestKind,
): Record<string, unknown> {
  return { ...model.contextManagement?.requestBodyHints?.[kind] };
}

/**
 * The model config a sub-agent runs with: `contextManagement.subagent` lowers
 * the context limit and overrides the auto-compaction settings, so the child
 * history compacts within its own budget instead of growing to the full
 * window. Returns the model unchanged when no sub-agent budget is configured.
 */
export function getSubagentModel(model: ModelConfig): ModelConfig {
  const budget = model.contextManagement?.subagent;
  if (!budget) {
    return model;
  }

  const contextLength =
    budget.contextLength === undefined
      ? undefined
      : Math.min(budget.contextLength, getModelContextLimit(model));

  return {
    ...model,
    defaultCompletionOptions: {
      ...model.defaultCompletionOptions,
      ...(contextLength === undefined ? {} : { contextLength }),
    },
    contextManagement: {
      ...model.contextManagement,
      autoCompactRatio:
        budget.autoCompactRatio ?? model.contextManagement?.autoCompactRatio,
      autoCompactTokens:
        budget.autoCompactTokens ?? model.contextManagement?.autoCompactTokens,
    },
  };
}
