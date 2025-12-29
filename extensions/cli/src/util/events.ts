import {
  post,
  ApiRequestError,
  AuthenticationRequiredError,
} from "./apiClient.js";
import { logger } from "./logger.js";

/**
 * Event types that can be emitted to the activity timeline
 */
export type ActionEventName =
  | "comment_posted"
  | "pr_created"
  | "commit_pushed"
  | "issue_closed"
  | "review_submitted";

/**
 * Parameters for emitting an activity event
 */
export interface EmitEventParams {
  /** The type of action event */
  eventName: ActionEventName | string;
  /** Human-readable title for the event */
  title: string;
  /** Optional longer description */
  description?: string;
  /** Optional event-specific metadata */
  metadata?: Record<string, unknown>;
  /** Optional external URL (e.g., link to GitHub PR or comment) */
  externalUrl?: string;
}

/**
 * Extract the agent ID from the --id command line flag
 * @returns The agent ID or undefined if not found
 */
export function getAgentIdFromArgs(): string | undefined {
  const args = process.argv;
  const idIndex = args.indexOf("--id");
  if (idIndex !== -1 && idIndex + 1 < args.length) {
    return args[idIndex + 1];
  }
  return undefined;
}

/**
 * POST an activity event to the control plane for an agent session.
 * Used to populate the Activity Timeline in the task detail view.
 *
 * @param agentId - The agent session ID
 * @param params - Event parameters
 * @returns The created event or undefined on failure
 */
export async function postAgentEvent(
  agentId: string,
  params: EmitEventParams,
): Promise<Record<string, unknown> | undefined> {
  if (!agentId) {
    logger.debug("No agent ID provided, skipping event emission");
    return undefined;
  }

  if (!params.eventName || !params.title) {
    logger.debug("Missing required event parameters, skipping event emission");
    return undefined;
  }

  try {
    logger.debug("Posting event to control plane", {
      agentId,
      eventName: params.eventName,
      title: params.title,
    });

    const response = await post(`agents/${agentId}/events`, {
      eventName: params.eventName,
      title: params.title,
      description: params.description,
      metadata: params.metadata,
      externalUrl: params.externalUrl,
    });

    if (response.ok) {
      logger.info("Successfully posted event to control plane", {
        eventName: params.eventName,
      });
      return response.data;
    } else {
      logger.warn(`Unexpected response when posting event: ${response.status}`);
      return undefined;
    }
  } catch (error) {
    // Non-critical: Log but don't fail the entire agent execution
    if (error instanceof AuthenticationRequiredError) {
      logger.debug(
        "Authentication required for event emission (skipping)",
        error.message,
      );
    } else if (error instanceof ApiRequestError) {
      logger.warn(
        `Failed to post event: ${error.status} ${error.response || error.statusText}`,
      );
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(`Error posting event: ${errorMessage}`);
    }
    return undefined;
  }
}
