import { formatTaskPlanBlock } from "core/util/taskPlan.js";
import type { ChatCompletionTool } from "openai/resources.mjs";

import { getSessionTaskPlan } from "../session.js";
import { TASK_LIST_TOOL_NAME } from "../tools/taskList.js";

/**
 * The task list block for this request (core/util/taskPlan.ts), or "" when
 * the TaskList tool is not offered or there is no list.
 */
export function taskListBlockForRequest(tools?: ChatCompletionTool[]): string {
  const offered = tools?.some(
    (t) => t.type === "function" && t.function.name === TASK_LIST_TOOL_NAME,
  );
  return offered ? formatTaskPlanBlock(getSessionTaskPlan()) : "";
}
