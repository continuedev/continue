import { getAgentTask } from "../util/taskStore.js";

import { Tool } from "./types.js";

export const taskOutputTool: Tool = {
  name: "TaskOutput",
  displayName: "TaskOutput",
  description: "Read the output log recorded for a tracked task.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["task_id"],
    properties: {
      task_id: {
        type: "string",
        description: "Task identifier whose output should be returned.",
      },
    },
  },
  run: async (args: { task_id: string }): Promise<string> => {
    const task = await getAgentTask(args.task_id);
    if (!task) {
      return `Task #${args.task_id} not found.`;
    }

    if (task.output.length === 0) {
      return `Task #${task.id} has no recorded output.`;
    }

    return [`Task #${task.id} output:`, ...task.output].join("\n");
  },
};
