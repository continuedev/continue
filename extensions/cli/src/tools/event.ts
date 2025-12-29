import { ContinueError, ContinueErrorReason } from "core/util/errors.js";

import {
  ApiRequestError,
  AuthenticationRequiredError,
} from "../util/apiClient.js";
import { getAgentIdFromArgs, postAgentEvent } from "../util/events.js";
import { logger } from "../util/logger.js";

import { Tool } from "./types.js";

export const eventTool: Tool = {
  name: "Event",
  displayName: "Event",
  description: `Report an activity event for the user to see in the task timeline.

Use this tool to notify the user about significant actions you've taken, such as:
- Creating a pull request
- Posting a comment on a PR or issue
- Pushing commits
- Closing an issue
- Submitting a review

Each event should have:
- eventName: A short identifier for the type of event (e.g., "pr_created", "comment_posted", "commit_pushed")
- title: A human-readable summary of what happened
- description: (optional) Additional details about the event
- externalUrl: (optional) A link to the relevant resource (e.g., GitHub PR URL)

Example usage:
- After creating a PR: eventName="pr_created", title="Created PR #123: Fix authentication bug", externalUrl="https://github.com/org/repo/pull/123"
- After posting a comment: eventName="comment_posted", title="Posted analysis comment on PR #45", externalUrl="https://github.com/org/repo/pull/45#issuecomment-123456"`,
  parameters: {
    type: "object",
    required: ["eventName", "title"],
    properties: {
      eventName: {
        type: "string",
        description:
          'A short identifier for the event type (e.g., "pr_created", "comment_posted", "commit_pushed", "issue_closed", "review_submitted")',
      },
      title: {
        type: "string",
        description:
          'A human-readable summary of the event (e.g., "Created PR #123: Fix authentication bug")',
      },
      description: {
        type: "string",
        description: "Optional additional details about the event",
      },
      externalUrl: {
        type: "string",
        description:
          "Optional URL linking to the relevant resource (e.g., GitHub PR or comment URL)",
      },
    },
  },
  readonly: true,
  isBuiltIn: true,
  run: async (args: {
    eventName: string;
    title: string;
    description?: string;
    externalUrl?: string;
  }): Promise<string> => {
    try {
      // Get agent ID from --id flag
      const agentId = getAgentIdFromArgs();
      if (!agentId) {
        const errorMessage =
          "Agent ID is required. Please use the --id flag with cn serve.";
        logger.error(errorMessage);
        throw new ContinueError(ContinueErrorReason.Unspecified, errorMessage);
      }

      // Post the event to the control plane
      const result = await postAgentEvent(agentId, {
        eventName: args.eventName,
        title: args.title,
        description: args.description,
        externalUrl: args.externalUrl,
      });

      if (result) {
        logger.info(`Event recorded: ${args.eventName} - ${args.title}`);
        return `Event recorded: ${args.title}`;
      } else {
        // Event posting failed but we don't want to fail the tool
        logger.warn(`Failed to record event: ${args.eventName}`);
        return `Event acknowledged (but may not have been recorded): ${args.title}`;
      }
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
          `Error recording event: ${error.status} ${error.response || error.statusText}`,
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error recording event: ${errorMessage}`);
      throw new Error(`Error recording event: ${errorMessage}`);
    }
  },
};
