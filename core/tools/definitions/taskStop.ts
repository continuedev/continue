import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskStopTool: Tool = {
  type: "function",
  displayTitle: "Task Stop",
  wouldLikeTo: "stop a tracked task",
  isCurrently: "stopping a tracked task",
  hasAlready: "stopped a tracked task",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskStop,
    description:
      "Mark a tracked task as cancelled and optionally record a reason.",
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
          description: "Optional explanation recorded in the task output log.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
