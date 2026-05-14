import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

export const taskUpdateTool: Tool = {
  type: "function",
  displayTitle: "Task Update",
  wouldLikeTo: "update a tracked task",
  isCurrently: "updating a tracked task",
  hasAlready: "updated a tracked task",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskUpdate,
    description:
      "Update fields on a tracked task, including status, ownership, dependency links, and output notes.",
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: {
          type: "string",
          description: "Task identifier to update.",
        },
        subject: {
          type: "string",
          description: "Optional replacement subject.",
        },
        description: {
          type: "string",
          description: "Optional replacement description.",
        },
        active_form: {
          type: "string",
          description: "Optional replacement active form label.",
        },
        status: {
          type: "string",
          description:
            "Optional replacement status: pending, in_progress, completed, failed, or cancelled.",
          enum: [...TASK_STATUSES],
        },
        owner: {
          type: "string",
          description: "Optional replacement owner.",
        },
        add_blocks: {
          type: "array",
          description: "Optional list of task IDs that this task blocks.",
          items: {
            type: "string",
          },
        },
        add_blocked_by: {
          type: "array",
          description: "Optional list of task IDs blocking this task.",
          items: {
            type: "string",
          },
        },
        append_output: {
          type: "string",
          description: "Append a line of output or notes to the task log.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
