import { LoopState } from "core";
import { taskPlanWithLoop } from "core/util/loopMode";
import { setLoop, setTaskPlan } from "../slices/sessionSlice";
import { AppThunkDispatch, RootState } from "../store";
import { applyModeModel } from "../thunks/applyModeModel";

/**
 * Stores Loop mode's state and makes the task list show its statuses. A loop
 * that ends while an item's own model is selected (LoopState.modelBefore)
 * comes back to the model it left.
 */
export function commitLoop(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  loop: LoopState | undefined,
) {
  const before = getState().session.loop;
  dispatch(setLoop(loop));
  const plan = getState().session.taskPlan;
  if (loop && plan) {
    const synced = taskPlanWithLoop(plan, loop);
    if (synced !== plan) dispatch(setTaskPlan(synced));
  }
  const left = before?.modelBefore;
  if (
    left &&
    before.status !== "stopped" &&
    (!loop || loop.status === "stopped")
  ) {
    void dispatch(applyModeModel({ mode: "agent", title: left }));
  }
}
