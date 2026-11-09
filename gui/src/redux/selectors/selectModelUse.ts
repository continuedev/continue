import type { ModelUse } from "core";
import { useForLoopTurn } from "core/util/modelUse";
import type { RootState } from "../store";

/**
 * What the next request is for, as `modeModels` keys it: a Loop item turn is
 * "loop", a re-plan "replan", anything else the session's mode. "background"
 * has no model of its own and resolves to nothing.
 */
export function selectModelUse(state: RootState): ModelUse | undefined {
  const { loop, mode } = state.session;
  if (loop && loop.status !== "stopped" && loop.current) {
    return useForLoopTurn(loop.current.kind);
  }
  return mode === "background" ? undefined : mode;
}

/**
 * The title of the model the running Loop item's run goes to when the to-do
 * names its own (TaskItem.model, resolved when the run started), else
 * undefined: the use's model applies.
 */
export function selectLoopItemModelTitle(state: RootState): string | undefined {
  const { loop } = state.session;
  if (!loop || loop.status === "stopped" || loop.current?.kind !== "item") {
    return undefined;
  }
  const itemId = loop.current.itemId;
  return loop.items.find((i) => i.id === itemId)?.model?.title || undefined;
}
