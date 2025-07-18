// Tool definition for reading the current markdown todo list. Returns the full
// markdown content with legend: [ ] planned, [x] done, [*] in progress, [~]
// cancelled.
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const todoReadTool: Tool = {
  type: "function",
  displayTitle: "TodoRead",
  wouldLikeTo: "read the todo list",
  isCurrently: "reading the todo list",
  hasAlready: "viewed the todo list",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TodoRead,
    description:
      "Read the current markdown todo list. Returns the full markdown content. " +
      "Use at the beginning of conversations, before starting new tasks, when " +
      "uncertain about next steps, or after completing tasks to track remaining " +
      "work. Format: [ ] planned, [x] done, [*] in progress, [~] cancelled. " +
      "Legend is included in HTML comments (<!-- ... -->).",
    parameters: {
      type: "object",
      required: [],
      properties: {},
    },
  },
};
