import { createAgentTask, formatAgentTaskDetails } from "../util/taskStore.js";

import { Tool } from "./types.js";

function requireText(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const taskCreateTool: Tool = {
  name: "TaskCreate",
  displayName: "TaskCreate",
  description: "Create a structured task for the current session.",
  readonly: false,
  isBuiltIn: true,
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
  run: async (args: {
    subject: string;
    description: string;
    active_form?: string;
    owner?: string;
  }): Promise<string> => {
    const task = await createAgentTask({
      subject: requireText(args.subject, "subject"),
      description: requireText(args.description, "description"),
      activeForm: optionalText(args.active_form),
      owner: optionalText(args.owner),
    });
    return `Created task:\n${formatAgentTaskDetails(task)}`;
  },
};
