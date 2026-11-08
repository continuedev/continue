import { ContinueError, ContinueErrorReason } from "core/util/errors";
import { buildTaskPlan, taskPlanConfirmation } from "core/util/taskPlan";
import { setTaskPlan } from "../../redux/slices/sessionSlice";
import { ClientToolImpl } from "./callClientTool";

/**
 * The task_list tool: validates the whole list, stores it on the session
 * (it is saved with it and sent at the tail of every request), and answers
 * with a short confirmation rather than the list.
 */
export const taskListImpl: ClientToolImpl = async (
  args,
  _toolCallId,
  extras,
) => {
  let items: unknown = args?.items;
  // Some models send the array as a JSON string.
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      // reported as "items must be an array" below
    }
  }

  // Only Plan mode makes a list. Agent mode can update the one it was given,
  // never replace it, and leaving an item out does not remove it.
  const planning = extras.getState().session.mode === "plan";
  const result = buildTaskPlan(items, {
    previous: extras.getState().session.taskPlan,
    reset: planning && (args?.reset === true || args?.reset === "true"),
    keepOpen: !planning,
    updatedBy: "model",
  });
  if (!result.ok) {
    throw new ContinueError(ContinueErrorReason.Unspecified, result.error);
  }

  extras.dispatch(setTaskPlan(result.plan));

  return {
    respondImmediately: true,
    output: [
      {
        name: "Task list",
        description: "Task list saved",
        content: taskPlanConfirmation(result.plan),
        hidden: false,
      },
    ],
  };
};
