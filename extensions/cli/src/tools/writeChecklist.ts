import type { Tool } from "./types.js";

export const writeChecklistTool: Tool = {
  name: "Checklist",
  displayName: "Checklist",
  description:
    "Create or update a task checklist to help the user track progress on multi-part work. Only use this when there are many distinct tasks to track or the user explicitly asks for a checklist. Do not use for simple or single-step tasks. Keep items high-level (e.g. \"Add auth middleware\" not \"Open src/middleware/auth.ts and add import statement\").",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["checklist"],
    properties: {
      checklist: {
        type: "string",
        description:
          "The complete checklist in markdown format using - [ ] for incomplete tasks and - [x] for completed tasks. Keep it short — prefer 3-7 high-level items. Avoid granular sub-steps or implementation details.",
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
