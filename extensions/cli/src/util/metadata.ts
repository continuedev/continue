import type { ChatHistoryItem } from "core/index.js";

import {
  post,
  ApiRequestError,
  AuthenticationRequiredError,
} from "./apiClient.js";
import { logger } from "./logger.js";

/**
 * Statistics about a git diff
 */
export interface DiffStats {
  additions: number;
  deletions: number;
}

/**
 * Calculate diff statistics from unified diff content
 * Counts lines added (+) and deleted (-), excluding metadata lines
 *
 * @param diffContent - The unified diff content as a string
 * @returns Object with additions and deletions counts
 */
export function calculateDiffStats(diffContent: string): DiffStats {
  if (!diffContent || diffContent.trim() === "") {
    return { additions: 0, deletions: 0 };
  }

  const lines = diffContent.split("\n");
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    // Skip diff metadata lines
    // File headers contain a space: "--- a/file" or "+++ b/file"
    // But code changes with ++ or -- at start don't: "+++counter;" or "---counter;"
    if (
      (line.startsWith("+++") && (line.length === 3 || line[3] === " ")) ||
      (line.startsWith("---") && (line.length === 3 || line[3] === " ")) ||
      line.startsWith("@@") ||
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("Binary files")
    ) {
      continue;
    }

    // Count actual code changes
    if (line.startsWith("+")) {
      additions++;
    } else if (line.startsWith("-")) {
      deletions++;
    }
  }

  return { additions, deletions };
}

/**
 * Extract the last assistant message from conversation history
 * Truncates if too long
 *
 * @param history - Array of chat history items
 * @param maxLength - Maximum length for the summary (default: 500)
 * @returns The last assistant message content, or undefined if none found
 */
export function extractSummary(
  history: ChatHistoryItem[],
  maxLength: number = 500,
): string | undefined {
  if (!history || history.length === 0) {
    return undefined;
  }

  // Find last assistant message (iterate backwards)
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "assistant") {
      const content =
        typeof item.message.content === "string"
          ? item.message.content
          : JSON.stringify(item.message.content);

      if (!content || content.trim() === "") {
        continue;
      }

      const trimmedContent = content.trim();

      // Truncate if too long
      if (trimmedContent.length <= maxLength) {
        return trimmedContent;
      }

      return trimmedContent.substring(0, maxLength - 3) + "...";
    }
  }

  return undefined;
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
 * POST metadata to the control plane for an agent session
 * Non-blocking and error-tolerant - failures are logged but don't throw
 *
 * @param agentId - The agent session ID
 * @param metadata - Arbitrary metadata object to post
 */
export async function postAgentMetadata(
  agentId: string,
  metadata: Record<string, any>,
): Promise<void> {
  if (!agentId) {
    logger.debug("No agent ID provided, skipping metadata update");
    return;
  }

  if (!metadata || Object.keys(metadata).length === 0) {
    logger.debug("Empty metadata object, skipping metadata update");
    return;
  }

  try {
    logger.debug("Posting metadata to control plane", {
      agentId,
      metadata,
    });

    const response = await post(`agents/${agentId}/metadata`, { metadata });

    if (response.ok) {
      logger.info("Successfully posted metadata to control plane");
    } else {
      logger.warn(
        `Unexpected response when posting metadata: ${response.status}`,
      );
    }
  } catch (error) {
    // Non-critical: Log but don't fail the entire agent execution
    if (error instanceof AuthenticationRequiredError) {
      logger.debug(
        "Authentication required for metadata update (skipping)",
        error.message,
      );
    } else if (error instanceof ApiRequestError) {
      logger.warn(
        `Failed to post metadata: ${error.status} ${error.response || error.statusText}`,
      );
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(`Error posting metadata: ${errorMessage}`);
    }
  }
}
