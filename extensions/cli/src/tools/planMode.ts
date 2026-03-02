import { services } from "../services/index.js";
import { logger } from "../util/logger.js";

import type { Tool } from "./types.js";

/**
 * ExitPlanMode tool - prompts the user to approve the plan and exit plan mode.
 *
 * When the agent is in plan mode, it should:
 * 1. Investigate with read-only tools
 * 2. Write a plan using the Checklist tool
 * 3. Call ExitPlanMode to present the plan for user approval
 *
 * On approval, the tool switches to normal mode so the agent can execute the plan.
 * On rejection, the agent stays in plan mode and can revise the plan.
 */
export const exitPlanModeTool: Tool = {
  name: "ExitPlanMode",
  displayName: "Exit Plan Mode",
  description: `Prompts the user to approve your plan and exit plan mode so you can begin implementation.

Before calling this tool, you MUST have already created a plan using the Checklist tool. The user will review your checklist plan and decide whether to approve it.

- If approved: you will exit plan mode and gain access to write tools (Write, Edit, MultiEdit) to execute the plan.
- If rejected: you remain in plan mode. Revise your plan based on user feedback and try again.

Only call this tool when you have a complete plan ready for review.`,
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["summary"],
    properties: {
      summary: {
        type: "string",
        description:
          "A brief 1-2 sentence summary of what your plan will accomplish. This is shown to the user alongside the checklist.",
      },
    },
  },

  preprocess: async (args: { summary: string }) => {
    return {
      preview: [
        {
          type: "text" as const,
          content: `Plan ready for review: ${args.summary}`,
          color: "blue",
        },
      ],
      args,
    };
  },

  run: async (args: { summary: string }) => {
    const { summary } = args;
    const toolPermissionService = services.toolPermissions;
    const currentMode = toolPermissionService.getCurrentMode();

    if (currentMode !== "plan") {
      return "You are not currently in plan mode. No action needed — you already have access to all tools.";
    }

    // Switch to normal mode to give the agent write access
    toolPermissionService.switchMode("normal");

    logger.debug("ExitPlanMode: switched from plan to normal mode");

    return [
      "Plan approved. You are now in agent mode with full tool access.",
      "",
      `Plan summary: ${summary}`,
      "",
      "Proceed with implementing the plan. Use the Checklist tool to mark items as completed as you go.",
    ].join("\n");
  },
};
