import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskCreateTool: Tool = {
  type: "function",
  displayTitle: "Task Create",
  wouldLikeTo: "create a tracked task",
  isCurrently: "creating a tracked task",
  hasAlready: "created a tracked task",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskCreate,
    description:
      "Create a structured task for the current session. Use this to track multi-step work, delegated work, or checkpoints that should remain visible across turns.",
    parameters: {
      type: "object",
      required: ["subject", "description"],
      properties: {
        subject: {
          type: "string",
          description: "Brief title for the task.",
        },
        description: {
          type: "string",
          description: "Detailed description of the work to track.",
        },
        active_form: {
          type: "string",
          description: "Present continuous label, e.g. Running tests.",
        },
        owner: {
          type: "string",
          description: "Optional owner or agent name for the task.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
