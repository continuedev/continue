import { formatAgentTaskDetails, updateAgentTask } from "../util/taskStore.js";

import { Tool } from "./types.js";

const TASK_STATUSES = new Set([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeIdList(values: string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

export const taskUpdateTool: Tool = {
  name: "TaskUpdate",
  displayName: "TaskUpdate",
  description: "Update fields on a tracked task.",
  readonly: false,
  isBuiltIn: true,
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
  run: async (args: {
    task_id: string;
    subject?: string;
    description?: string;
    active_form?: string;
    status?: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
    owner?: string;
    add_blocks?: string[];
    add_blocked_by?: string[];
    append_output?: string;
  }): Promise<string> => {
    if (args.status && !TASK_STATUSES.has(args.status)) {
      throw new Error(`Invalid task status: ${args.status}`);
    }

    const task = await updateAgentTask(args.task_id, {
      subject: optionalText(args.subject),
      description: optionalText(args.description),
      activeForm: optionalText(args.active_form),
      status: args.status,
      owner: optionalText(args.owner),
      addBlocks: normalizeIdList(args.add_blocks),
      addBlockedBy: normalizeIdList(args.add_blocked_by),
      appendOutput: optionalText(args.append_output),
    });

    if (!task) {
      return `Task #${args.task_id} not found.`;
    }

    return `Updated task:\n${formatAgentTaskDetails(task)}`;
  },
};
