/**
 * TodoWriteTool — ported and adapted from Marcel (Yuto Code) TodoWriteTool.
 *
 * Gives the agent a structured, in-session todo list it can read and update.
 * The model uses this to self-track progress and signal when verification is needed.
 */
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority: "high" | "medium" | "low";
}

const STATUS_VALUES: TodoStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

export const todoWriteTool: Tool = {
  type: "function",
  displayTitle: "Update Todo List",
  wouldLikeTo: "update the todo list",
  isCurrently: "updating the todo list",
  hasAlready: "updated the todo list",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TodoWrite,
    description: `Use this tool to create and maintain a structured to-do list for your current task.
Call this tool when you start a multi-step task to plan your work, and update it as you complete steps.

Guidelines:
- Create todos at the start of a complex task to break it down.
- Update todo statuses as you make progress (pending → in_progress → completed).
- Add new todos when you discover additional steps needed.
- Mark todos as 'cancelled' if they become irrelevant.
- Keep todo content concise and action-oriented.
- Set priority: 'high' for blocking items, 'medium' for normal work, 'low' for nice-to-have.

The todo list is visible to the user and helps them track your progress.`,
    parameters: {
      type: "object",
      required: ["todos"],
      properties: {
        todos: {
          type: "array",
          description:
            "The complete updated todo list. Always send the full list, not just changes.",
          items: {
            type: "object",
            required: ["id", "content", "status", "priority"],
            properties: {
              id: {
                type: "string",
                description:
                  "Stable unique identifier for this todo item. Use a short slug, e.g. 'read-file-1'.",
              },
              content: {
                type: "string",
                description: "Short action-oriented description of the task.",
              },
              status: {
                type: "string",
                enum: STATUS_VALUES,
                description: "Current status of the todo item.",
              },
              priority: {
                type: "string",
                enum: ["high", "medium", "low"],
                description: "Priority level for ordering.",
              },
            },
          },
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To track your progress on a multi-step task, use the ${BuiltInToolNames.TodoWrite} tool. Pass the complete todo list on every call. For example:`,
    exampleArgs: [
      [
        "todos",
        JSON.stringify([
          {
            id: "read-file",
            content: "Read the target file",
            status: "completed",
            priority: "high",
          },
          {
            id: "apply-edit",
            content: "Apply the requested edit",
            status: "in_progress",
            priority: "high",
          },
          {
            id: "run-tests",
            content: "Run tests to verify the change",
            status: "pending",
            priority: "medium",
          },
        ]),
      ],
    ],
  },
};
