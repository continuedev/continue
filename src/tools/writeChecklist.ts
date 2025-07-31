import type { Tool } from "./types.js";

export const writeChecklistTool: Tool = {
  name: "write_checklist",
  displayName: "Update Task List",
  description:
    "Create or update a task checklist. Use this to plan/prepare and then mark tasks completed as you go. The old checklist can be seen in the chat history if it exists. Use this tool to write a new checklist or edit the existing one.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    checklist: {
      type: "string",
      description:
        "The full checklist in markdown format using - [ ] for incomplete tasks and - [x] for completed tasks. Avoid content other than checkbox items unless it is labels to split up groups of checkboxes",
      required: true,
    },
  },
  run: async (args: { checklist: string }) => {
    return `Task list status:\n${args.checklist}`;
  },
};
