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
