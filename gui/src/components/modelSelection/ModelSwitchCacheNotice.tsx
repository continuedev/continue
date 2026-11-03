import { findAnthropicPricing } from "core/llm/utils/calculateRequestCost";
import {
  formatSwitchCost,
  modelSupportsPromptCacheControl,
  promptCacheStatus,
  switchCost,
} from "../../util/promptCache";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";

/**
 * One line shown while the prompt cache is warm: picking another model starts
 * an empty cache for it (each model has its own), so the whole conversation is
 * re-read at the write price. The estimate uses the size of the last request.
 */
export function ModelSwitchCacheNotice() {
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector((s) =>
    model ? s.ui.promptCacheSettings?.[model.title] : undefined,
  );
  const state = useAppSelector((s) => s.session.promptCache);

  if (!model || !state || !modelSupportsPromptCacheControl(model)) return null;

  const status = promptCacheStatus(model, setting, state, Date.now());
  const price = findAnthropicPricing(model.model)?.input;
  const cost = switchCost(status, state, price);
  if (!cost) return null;

  return (
    <div
      className="border-0 border-t border-solid border-t-border px-2 py-1 text-[10px] text-description-muted"
      data-testid="model-switch-cache-notice"
    >
      Prompt cache is warm. Switching model re-reads {formatSwitchCost(cost)} at
      full price.
    </div>
  );
}
