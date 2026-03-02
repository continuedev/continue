import { services } from "../services/index.js";
import { logger } from "../util/logger.js";

import type { Tool } from "./types.js";

/**
 * ExitPlanMode tool - exits plan mode so the agent can begin implementation.
 *
 * When the agent is in plan mode, it should:
 * 1. Investigate with read-only tools
 * 2. Present a plan in its response text
 * 3. Call ExitPlanMode to switch to agent mode
 *
 * The tool switches to normal mode so the agent can execute.
 */
export const exitPlanModeTool: Tool = {
  name: "ExitPlanMode",
  displayName: "Exit Plan Mode",
  description: `Exit plan mode and switch to agent mode so you can begin implementation.

Call this after you have presented your plan to the user in your response. Once called, you will gain access to write tools (Write, Edit, MultiEdit) to execute your plan.

Only call this tool when you have explained your plan and are ready to start implementing.`,
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
      "Proceed with implementing the plan.",
    ].join("\n");
  },
};
