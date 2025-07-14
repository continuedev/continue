import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskListTool: Tool = {
  type: "function",
  displayTitle: "Task List Manager",
  wouldLikeTo: "manage tasks in the queue",
  isCurrently: "managing tasks",
  hasAlready: "managed tasks",
  readonly: false,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskList,
    description:
      'Manage and execute tasks in a queue-based system. Supports adding, updating, removing, and monitoring tasks. The "start" action will always start the next task in the queue. You should keep executing the tasks until hasNextTask is false.',
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["add", "update", "remove", "list", "start"],
          description: "The action to perform on the task.",
        },
        name: {
          type: "string",
          description:
            "A short useful name for the task. Required when adding or updating a task",
        },
        description: {
          type: "string",
          description:
            "A detailed description of the task. Required when adding or updating a task",
        },
        taskId: {
          type: "string",
          description: "Required when updating or removing a task",
        },
      },
    },
  },
};
