import { shouldAutoEnableSystemMessageTools } from "core/config/shouldAutoEnableSystemMessageTools";
import { selectSelectedChatModel } from "../slices/configSlice";
import { RootState } from "../store";

/**
 * Selector that determines if system message tools should be used.
 * This prioritizes auto-detection over manual configuration where we have a strong preference.
 *
 * Priority order:
 * 1. Auto-detection (if it returns true/false)
 * 2. Manual user configuration (if auto-detection returns undefined)
 * 3. Default to false
 *
 * @param state The Redux root state
 * @returns true if system message tools should be used, false otherwise
 */
export function selectUseSystemMessageTools(state: RootState): boolean {
  const selectedModel = selectSelectedChatModel(state);
  const manualSetting =
    state.config.config.experimental?.onlyUseSystemMessageTools;

  // If no model is selected, fall back to manual setting or default
  if (!selectedModel) {
    return manualSetting ?? false;
  }

  // Check auto-detection first
  const autoSetting = shouldAutoEnableSystemMessageTools(selectedModel);

  // If auto-detection has a preference, use it (takes priority)
  if (autoSetting !== undefined) {
    return autoSetting;
  }

  // If no auto-preference, use manual setting or default to false
  return manualSetting ?? false;
}
