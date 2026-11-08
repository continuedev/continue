import { formatTaskPlanBlock } from "core/util/taskPlan.js";
import type { ChatCompletionTool } from "openai/resources.mjs";

import { loopPlanBlockForRequest } from "../loop/loopSession.js";
import { getSessionTaskPlan } from "../session.js";
import { TASK_LIST_TOOL_NAME } from "../tools/taskList.js";

/**
 * The task list block for this request (core/util/taskPlan.ts), or "" when
 * the TaskList tool is not offered or there is no list, and while Loop mode
 * runs an item: that run gets the loop's plan block in its first message
 * instead (loopRequestHistory), and the TaskList tool is hidden from it.
 */
export function taskListBlockForRequest(
  tools?: ChatCompletionTool[],
  isCompacting = false,
): string {
  if (loopPlanBlockForRequest(isCompacting)) return "";
  const offered = tools?.some(
    (t) => t.type === "function" && t.function.name === TASK_LIST_TOOL_NAME,
  );
  return offered ? formatTaskPlanBlock(getSessionTaskPlan()) : "";
}
