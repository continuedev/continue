import { ILLM } from "core";

export const FAST_APPLY_MODELS: Array<ILLM["model"]> = ["Fast-Apply"];

/**
 * Checks against model names, which can include proxy prefixes
 * such as `continuedev/hub`
 * @param llm
 * @returns
 */
export function isFastApplyModel(llm: ILLM): boolean {
  return FAST_APPLY_MODELS?.some((fastApplyModel) =>
    llm.model.toLowerCase().includes(fastApplyModel.toLowerCase())
  );
}
