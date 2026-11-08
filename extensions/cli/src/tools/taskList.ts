import type { TaskPlan } from "core/index.js";
import {
  buildTaskPlan,
  TASK_LIST_TOOL_DESCRIPTION,
  TASK_PLAN_LIMITS,
  TASK_STATUSES,
  taskPlanConfirmation,
  taskPlanToMarkdown,
} from "core/util/taskPlan.js";

import { services } from "../services/index.js";
import { getSessionTaskPlan, updateSessionTaskPlan } from "../session.js";

import type { Tool } from "./types.js";

function parseItems(items: unknown): unknown {
  // Some models send the array as a JSON string.
  if (typeof items === "string") {
    try {
      return JSON.parse(items);
    } catch {
      return items;
    }
  }
  return items;
}

/**
 * Validates `items` against the session's current list and returns the plan
 * it would store, or throws with the reason.
 */
export function planFromToolArgs(args: {
  items?: unknown;
  reset?: unknown;
}): TaskPlan {
  // Only plan mode makes a list. Otherwise the model can update the one it was
  // given, never replace it, and leaving an item out does not remove it.
  const planning = services.toolPermissions.getCurrentMode() === "plan";
  const result = buildTaskPlan(parseItems(args.items), {
    previous: getSessionTaskPlan(),
    reset: planning && (args.reset === true || args.reset === "true"),
    keepOpen: !planning,
    updatedBy: "model",
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.plan;
}

/** Stores the plan on the session and returns the tool's short answer. */
export function saveTaskPlan(plan: TaskPlan): string {
  updateSessionTaskPlan(plan);
  return taskPlanConfirmation(plan);
}

export const TASK_LIST_TOOL_NAME = "TaskList";

export const taskListTool: Tool = {
  name: TASK_LIST_TOOL_NAME,
  displayName: "Task List",
  description: TASK_LIST_TOOL_DESCRIPTION,
  // It changes no files.
  readonly: true,
  isBuiltIn: true,
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
              description: `One of ${TASK_STATUSES.join(", ")}`,
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
  preprocess: async (args: { items?: unknown; reset?: unknown }) => {
    const plan = planFromToolArgs(args);
    return {
      preview: [
        { type: "checklist" as const, content: taskPlanToMarkdown(plan) },
      ],
      args,
    };
  },
  run: async (args: { items?: unknown; reset?: unknown }) => {
    return saveTaskPlan(planFromToolArgs(args));
  },
};
