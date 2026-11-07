import { parseMarkdownChecklist } from "core/util/taskPlan.js";

import { planFromToolArgs, saveTaskPlan } from "./taskList.js";
import type { Tool } from "./types.js";

/**
 * `Checklist`, kept as an alias of `TaskList` so prompts, rules and old
 * sessions that name it keep working. It takes the old markdown form
 * (`- [ ]` / `- [x]`, plus `[>]` in progress, `[-]` cancelled, `[!]` blocked)
 * and stores it as the session's task list, matching items to the current
 * list by text so their ids stay the same.
 */
export const writeChecklistTool: Tool = {
  name: "Checklist",
  displayName: "Checklist",
  description:
    "Older form of TaskList: write the whole task list as markdown checkboxes. Prefer TaskList.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["checklist"],
    properties: {
      checklist: {
        type: "string",
        description:
          "The complete checklist in markdown format using - [ ] for incomplete tasks and - [x] for completed tasks (also [>] in progress, [-] cancelled, [!] blocked). Avoid headers and additional content unless specifically being used to group checkboxes. Try to keep the list short, and make each item specific and actionable.",
      },
    },
  },
  preprocess: async (args: { checklist: string }) => {
    return {
      preview: [
        {
          type: "checklist" as const,
          content: args.checklist,
        },
      ],
      args,
    };
  },
  run: async (args: { checklist: string }) => {
    const items = parseMarkdownChecklist(String(args.checklist ?? ""));
    return saveTaskPlan(planFromToolArgs({ items }));
  },
};
