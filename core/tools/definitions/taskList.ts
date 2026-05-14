import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskListTool: Tool = {
  type: "function",
  displayTitle: "Task List",
  wouldLikeTo: "list tracked tasks",
  isCurrently: "listing tracked tasks",
  hasAlready: "listed tracked tasks",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskList,
    description: "List all tracked tasks for the current session.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
