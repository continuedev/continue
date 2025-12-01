import type { ChatHistoryItem } from "core/index.js";

import { sentryService } from "../sentry.js";
import { telemetryService } from "../telemetry/telemetryService.js";

import { getGitDiffSnapshot } from "./git.js";
import { logger } from "./logger.js";
import {
  calculateDiffStats,
  extractSummary,
  getAgentIdFromArgs,
  postAgentMetadata,
} from "./metadata.js";

/**
 * Update agent session metadata in control plane
 * Collects diff stats and conversation summary, posts to control plane
 * This is called both during execution (after each turn) and before exit
 *
 * @param history - Chat history to extract summary from (optional, will fetch if not provided)
 */
export async function updateAgentMetadata(
  history?: ChatHistoryItem[],
): Promise<void> {
  try {
    const agentId = getAgentIdFromArgs();
    if (!agentId) {
      logger.debug("No agent ID found, skipping metadata update");
      return;
    }

    const metadata: Record<string, any> = {};

    // Calculate diff stats
    try {
      const { diff, repoFound } = await getGitDiffSnapshot();
      if (repoFound && diff) {
        const { additions, deletions } = calculateDiffStats(diff);
        if (additions > 0 || deletions > 0) {
          metadata.additions = additions;
          metadata.deletions = deletions;
        }
      }
    } catch (err) {
      logger.debug("Failed to calculate diff stats (non-critical)", err as any);
    }

    // Extract summary from conversation
    if (history && history.length > 0) {
      try {
        const summary = extractSummary(history);
        if (summary) {
          metadata.summary = summary;
        }
      } catch (err) {
        logger.debug(
          "Failed to extract conversation summary (non-critical)",
          err as any,
        );
      }
    }

    // Post metadata if we have any
    if (Object.keys(metadata).length > 0) {
      await postAgentMetadata(agentId, metadata);
    }
  } catch (err) {
    // Non-critical: log but don't fail the process
    logger.debug("Error in updateAgentMetadata (ignored)", err as any);
  }
}

/**
 * Exit the process after flushing telemetry and error reporting.
 * Use this instead of process.exit() to avoid losing metrics/logs.
 */
export async function gracefulExit(code: number = 0): Promise<void> {
  try {
    // Flush metrics (forceFlush + shutdown inside service)
    await telemetryService.shutdown();
  } catch (err) {
    logger.debug("Telemetry shutdown error (ignored)", err as any);
  }

  try {
    // Flush Sentry (best effort)
    await sentryService.flush();
  } catch (err) {
    logger.debug("Sentry flush error (ignored)", err as any);
  }

  // Exit the process
  process.exit(code);
}
