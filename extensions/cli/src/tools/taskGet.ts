import { formatAgentTaskDetails, getAgentTask } from "../util/taskStore.js";

import { Tool } from "./types.js";

export const taskGetTool: Tool = {
  name: "TaskGet",
  displayName: "TaskGet",
  description: "Get the full details for a tracked task.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["task_id"],
    properties: {
      task_id: {
        type: "string",
        description: "The task identifier returned from TaskCreate.",
      },
    },
  },
  run: async (args: { task_id: string }): Promise<string> => {
    const task = await getAgentTask(args.task_id);
    if (!task) {
      return `Task #${args.task_id} not found.`;
    }

    return formatAgentTaskDetails(task);
  },
};
