import { formatAgentTask, listAgentTasks } from "../util/taskStore.js";

import { Tool } from "./types.js";

export const taskListTool: Tool = {
  name: "TaskList",
  displayName: "TaskList",
  description: "List tracked tasks for the current session.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {},
  },
  run: async (): Promise<string> => {
    const tasks = await listAgentTasks();
    if (tasks.length === 0) {
      return "No tracked tasks.";
    }
    return [
      `Tracked tasks (${tasks.length}):`,
      ...tasks.map((task) => formatAgentTask(task)),
    ].join("\n");
  },
};
