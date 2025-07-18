// Tool definition for writing markdown todo lists. Accepts the full markdown
// content and stores it in history. Format: [ ] planned, [x] done, [*] in
// progress, [~] cancelled.
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const todoWriteTool: Tool = {
  type: "function",
  displayTitle: "TodoWrite",
  wouldLikeTo: "update the todo list",
  isCurrently: "updating the todo list",
  hasAlready: "updated the todo list",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TodoWrite,
    description:
      "CRITICAL: You MUST update todo status right away as a todo CHANGES from PLANNED to IN PROGRESS to COMPLETED, or is CANCELLED. " +
      "Write the full markdown todo list. Use for complex multi-step tasks, non-trivial " +
      "operations, when user provides multiple tasks, or after receiving new instructions. " +
      "Use subtask todos to break down complex todos, indented 2 spaces under the parent todo. " +
      "Format: - [ ] planned, - [x] done, - [*] in progress, - [~] cancelled. " +
      "Always include the format legend at top in HTML comments (<!-- ... -->).",
    parameters: {
      type: "object",
      required: ["markdown"],
      properties: {
        markdown: {
          type: "string",
          description:
            "The full markdown content for the todo list including HTML-commented legend and all tasks",
        },
      },
    },
  },
};
