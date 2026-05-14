import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskOutputTool: Tool = {
  type: "function",
  displayTitle: "Task Output",
  wouldLikeTo: "read task output",
  isCurrently: "reading task output",
  hasAlready: "read task output",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskOutput,
    description: "Read the recorded output or notes for a tracked task.",
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: {
          type: "string",
          description: "Task identifier to inspect.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
