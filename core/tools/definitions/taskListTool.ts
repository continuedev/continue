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
      'Manage and execute tasks in a queue-based system. Supports adding, updating, removing, and monitoring tasks. When you perform "runAllTasks" action, you should keep executing the tasks until hasNextTask is false. Before executing any task, set the task to in progress by using the "runTask" action.',
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: [
            "add",
            "update",
            "remove",
            "list",
            "runTask",
            "runAllTasks",
            "completeTask",
          ],
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
          description:
            "Required when running, updating, completing or removing a specific task",
        },
      },
    },
  },
};
