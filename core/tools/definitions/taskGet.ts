import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskGetTool: Tool = {
  type: "function",
  displayTitle: "Task Get",
  wouldLikeTo: "read a tracked task",
  isCurrently: "reading a tracked task",
  hasAlready: "read a tracked task",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskGet,
    description:
      "Fetch the full details for a tracked task in the current session.",
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: {
          type: "string",
          description: "Task identifier to retrieve.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
