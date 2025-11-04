import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import {
  ApiRequestError,
  AuthenticationRequiredError,
  post,
} from "../util/apiClient.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

/**
 * Extract the agent ID from the --id command line flag
 */
function getAgentIdFromArgs(): string | undefined {
  const args = process.argv;
  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && idIndex + 1 < args.length) {
    return args[idIndex + 1];
  }
  return undefined;
}

export const statusTool: Tool = {
  name: "Status",
  displayName: "Status",
  description: `Set the current status of your task for the user to see

The default available statuses are:
- PLANNING: You are creating a plan before beginning implementation
- WORKING: The task is in progress
- DONE: The task is complete
- BLOCKED: You need further information from the user in order to proceed

However, if the user explicitly specifies in their prompt to use one or more different statuses, you can use those as well.

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
    try {
      // Get agent ID from --id flag
      const agentId = getAgentIdFromArgs();
      if (!agentId) {
        const errorMessage =
          "Agent ID is required. Please use the --id flag with cn serve.";
        logger.error(errorMessage);
        throw new ContinueError(ContinueErrorReason.Unspecified, errorMessage);
      }

      // Call the API endpoint using shared client
      await post(`agents/${agentId}/status`, { status: args.status });

      logger.info(`Status: ${args.status}`);
      return `Status set: ${args.status}`;
    } catch (error) {
      if (error instanceof ContinueError) {
        throw error;
      }

      if (error instanceof AuthenticationRequiredError) {
        logger.error(error.message);
        throw new Error("Error: Authentication required");
      }

      if (error instanceof ApiRequestError) {
        throw new Error(
          `Error setting status: ${error.status} ${error.response || error.statusText}`,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error setting status: ${errorMessage}`);
      throw new Error(`Error setting status: ${errorMessage}`);
    }
  },
};
