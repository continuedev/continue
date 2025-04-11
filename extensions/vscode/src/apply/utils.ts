import { ILLM } from "core";
import { Relace } from "core/llm/llms/Relace";

export const FAST_APPLY_MODELS: Record<
  ILLM["providerName"],
  Array<ILLM["model"]>
> = {
  [Relace.providerName]: ["Fast-Apply"],
};

/**
 * Checks against model names, which can include proxy prefixes
 * such as `continuedev/hub`
 * @param llm
 * @returns
 */
export function isFastApplyModel(llm: ILLM): boolean {
  const fastModelsForProvider = FAST_APPLY_MODELS[llm.providerName];
  return (
    fastModelsForProvider?.some((fastModel) => llm.model.includes(fastModel)) ??
    false
  );
}
