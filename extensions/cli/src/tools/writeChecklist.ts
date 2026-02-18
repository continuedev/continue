import type { Tool } from "./types.js";

export const writeChecklistTool: Tool = {
  name: "Checklist",
  displayName: "Checklist",
  description:
    "Create or update a task checklist. The old checklist can be seen in the chat history if it exists. Use this tool to write a new checklist or edit the existing one.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["checklist"],
    properties: {
      checklist: {
        type: "string",
        description:
          "The complete checklist in markdown format using - [ ] for incomplete tasks and - [x] for completed tasks. Avoid headers and additional content unless specifically being used to group checkboxes. Try to keep the list short, and make each item specific and actionable.",
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
    return `Task list status:\n${args.checklist}`;
  },
};
