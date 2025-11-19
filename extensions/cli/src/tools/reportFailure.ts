import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import { sentryService } from "../sentry.js";
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

export const reportFailureTool: Tool = {
  name: "ReportFailure",
  displayName: "Report Failure",
  description:
    "Report that the task has failed due to an unrecoverable error. Include a succinct explanation for the user.",
  parameters: {
    type: "object",
    required: ["errorMessage"],
    properties: {
      errorMessage: {
        type: "string",
        description: "Explain what went wrong and why you cannot continue.",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: { errorMessage: string }): Promise<string> => {
    try {
      const trimmedMessage = args.errorMessage.trim();
      if (!trimmedMessage) {
        throw new ContinueError(
          ContinueErrorReason.Unspecified,
          "errorMessage is required to report a failure.",
        );
      }

      const agentId = getAgentIdFromArgs();
      if (!agentId) {
        const errorMessage =
          "Agent ID is required. Please use the --id flag with cn serve.";
        logger.error(errorMessage);
        throw new ContinueError(ContinueErrorReason.Unspecified, errorMessage);
      }

      // Capture failure in Sentry with context
      sentryService.captureException(
        new Error(trimmedMessage),
        {
          agent_failure: {
            agentId,
            errorMessage: trimmedMessage,
          },
        },
        "fatal",
      );

      await post(`agents/${agentId}/status`, {
        status: "FAILED",
        errorMessage: trimmedMessage,
      });

      logger.info(`Failure reported: ${trimmedMessage}`);
      return "Failure reported to user.";
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
          `Error reporting failure: ${error.status} ${error.response || error.statusText}`,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error reporting failure: ${errorMessage}`);
      throw new Error(`Error reporting failure: ${errorMessage}`);
    }
  },
};
