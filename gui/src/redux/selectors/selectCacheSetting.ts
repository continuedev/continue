import type { RootState } from "../store";
import {
  effectiveCacheSetting,
  type PromptCacheSetting,
} from "../../util/promptCache";
import { selectSelectedChatModel } from "../slices/configSlice";

/**
 * The prompt cache setting in force for the selected chat model: the toolbar
 * choice, or, when there is none and config.yaml says nothing, the default for
 * the current mode (see `effectiveCacheSetting`). Every place that asks whether
 * caching is on, or what it costs, reads this and not the stored choice, so a
 * notice cannot disagree with what the request does.
 */
export function selectCacheSetting(
  state: RootState,
): PromptCacheSetting | undefined {
  const model = selectSelectedChatModel(state);
  const chosen = model
    ? state.ui.promptCacheSettings?.[model.title]
    : undefined;
  return effectiveCacheSetting(model, chosen, state.session.mode);
}

/** The toolbar choice alone, for the menu to show what was picked. */
export function selectChosenCacheSetting(
  state: RootState,
): PromptCacheSetting | undefined {
  const model = selectSelectedChatModel(state);
  return model ? state.ui.promptCacheSettings?.[model.title] : undefined;
}
