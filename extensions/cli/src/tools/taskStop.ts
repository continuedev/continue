import { formatAgentTaskDetails, stopAgentTask } from "../util/taskStore.js";

import { Tool } from "./types.js";

export const taskStopTool: Tool = {
  name: "TaskStop",
  displayName: "TaskStop",
  description: "Cancel a tracked task.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["task_id"],
    properties: {
      task_id: {
        type: "string",
        description: "Task identifier to stop.",
      },
      reason: {
        type: "string",
        description: "Optional reason to append to the task output log.",
      },
    },
  },
  run: async (args: { task_id: string; reason?: string }): Promise<string> => {
    const task = await stopAgentTask(args.task_id, args.reason);
    if (!task) {
      return `Task #${args.task_id} not found.`;
    }

    return `Stopped task:\n${formatAgentTaskDetails(task)}`;
  },
};
