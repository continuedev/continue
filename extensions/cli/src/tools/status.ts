import { logger } from "src/util/logger.js";

import { Tool } from "./types.js";

export const statusTool: Tool = {
  name: "Status",
  displayName: "Status",
  description: `Set the current status of your task for the user to see

The available statuses are:
- PLANNING: You are creating a plan before beginning implementation
- WORKING: The task is in progress
- DONE: The task is complete
- BLOCKED: You need further information from the user in order to proceed

You should use this tool to notify the user whenever the state of your work changes. By default, the status is assumed to be "PLANNING" prior to you setting a different status.`,
  parameters: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "string",
        description: "The status value to set",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: { status: string }): Promise<string> => {
    logger.info(`Status: ${args.status}`);
    return `Status set: ${args.status}`;
  },
};
