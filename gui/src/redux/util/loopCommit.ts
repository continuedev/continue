import { LoopState } from "core";
import { taskPlanWithLoop } from "core/util/loopMode";
import { setLoop, setTaskPlan } from "../slices/sessionSlice";
import { AppThunkDispatch, RootState } from "../store";

/** Stores Loop mode's state and makes the task list show its statuses. */
export function commitLoop(
  dispatch: AppThunkDispatch,
  getState: () => RootState,
  loop: LoopState | undefined,
) {
  dispatch(setLoop(loop));
  const plan = getState().session.taskPlan;
  if (loop && plan) {
    const synced = taskPlanWithLoop(plan, loop);
    if (synced !== plan) dispatch(setTaskPlan(synced));
  }
}
