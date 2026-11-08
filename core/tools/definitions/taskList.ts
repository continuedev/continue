import { Tool } from "../..";
import {
  TASK_LIST_TOOL_DESCRIPTION,
  TASK_PLAN_LIMITS,
  TASK_STATUSES,
} from "../../util/taskPlan";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const taskListTool: Tool = {
  type: "function",
  displayTitle: "Task List",
  wouldLikeTo: "update the task list",
  isCurrently: "updating the task list",
  hasAlready: "updated the task list",
  // It changes no files, so plan mode keeps it.
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TaskList,
    description: TASK_LIST_TOOL_DESCRIPTION,
    parameters: {
      type: "object",
      required: ["items"],
      properties: {
        items: {
          type: "array",
          description: `The whole list, at most ${TASK_PLAN_LIMITS.maxItems} items.`,
          items: {
            type: "object",
            required: ["text", "status"],
            properties: {
              id: {
                type: "string",
                description:
                  "The item's id from the current list; omit for a new item",
              },
              text: {
                type: "string",
                description: `What to do, at most ${TASK_PLAN_LIMITS.maxTextLength} characters`,
              },
              status: {
                type: "string",
                enum: [...TASK_STATUSES],
              },
              note: {
                type: "string",
                description: "Why the item is blocked or cancelled",
              },
              activeForm: {
                type: "string",
                description: "Present-tense label shown while in progress",
              },
            },
          },
        },
        reset: {
          type: "boolean",
          description:
            "Replace the list entirely, dropping completed items too. Use for unrelated new work.",
        },
      },
    },
  },
  systemMessageDescription: {
    prefix: `Use the ${BuiltInToolNames.TaskList} tool to keep the task list, with the complete list each time. Exactly one item is in_progress while you work; mark items completed as soon as they are done. Statuses: ${TASK_STATUSES.join(", ")}. The list is sent back to you with every request. For example:`,
    exampleArgs: [
      [
        "items",
        `[{"id":"1","text":"Add the migration","status":"completed"},{"id":"2","text":"Run the tests","status":"in_progress","activeForm":"Running the tests"},{"text":"Update the docs","status":"pending"}]`,
      ],
    ],
  },
  defaultToolPolicy: "allowedWithoutPermission",
  toolCallIcon: "ListBulletIcon",
};
