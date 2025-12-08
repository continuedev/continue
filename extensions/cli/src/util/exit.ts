import type { ChatHistoryItem } from "core/index.js";

import { sentryService } from "../sentry.js";
import { getSessionUsage } from "../session.js";
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

    // Extract session usage (cost and token counts)
    try {
      const usage = getSessionUsage();
      if (usage.totalCost > 0) {
        metadata.usage = {
          totalCost: parseFloat(usage.totalCost.toFixed(6)),
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          ...(usage.promptTokensDetails?.cachedTokens && {
            cachedTokens: usage.promptTokensDetails.cachedTokens,
          }),
          ...(usage.promptTokensDetails?.cacheWriteTokens && {
            cacheWriteTokens: usage.promptTokensDetails.cacheWriteTokens,
          }),
        };
      }
    } catch (err) {
      logger.debug("Failed to get session usage (non-critical)", err as any);
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
 * Display session usage breakdown in verbose mode
 */
function displaySessionUsage(): void {
  const isVerbose = process.argv.includes("--verbose");
  if (!isVerbose) {
    return;
  }

  try {
    const usage = getSessionUsage();
    if (usage.totalCost === 0) {
      return; // No usage to display
    }

    logger.info("\n" + "=".repeat(60));
    logger.info("Session Usage Summary");
    logger.info("=".repeat(60));
    logger.info(`Total Cost: $${usage.totalCost.toFixed(6)}`);
    logger.info("");
    logger.info("Token Usage:");
    logger.info(`  Input Tokens:      ${usage.promptTokens.toLocaleString()}`);
    logger.info(
      `  Output Tokens:     ${usage.completionTokens.toLocaleString()}`,
    );

    if (usage.promptTokensDetails?.cachedTokens) {
      logger.info(
        `  Cache Read Tokens: ${usage.promptTokensDetails.cachedTokens.toLocaleString()}`,
      );
    }

    if (usage.promptTokensDetails?.cacheWriteTokens) {
      logger.info(
        `  Cache Write Tokens: ${usage.promptTokensDetails.cacheWriteTokens.toLocaleString()}`,
      );
    }

    const totalTokens = usage.promptTokens + usage.completionTokens;
    logger.info(`  Total Tokens:      ${totalTokens.toLocaleString()}`);
    logger.info("=".repeat(60) + "\n");
  } catch (err) {
    logger.debug("Failed to display session usage (non-critical)", err as any);
  }
}

/**
 * Exit the process after flushing telemetry and error reporting.
 * Use this instead of process.exit() to avoid losing metrics/logs.
 */
export async function gracefulExit(code: number = 0): Promise<void> {
  // Display session usage breakdown in verbose mode
  displaySessionUsage();

  // Clean up background processes
  try {
    const { serviceContainer, SERVICE_NAMES } = await import(
      "../services/index.js"
    );
    const { BackgroundProcessService } = await import(
      "../services/BackgroundProcessService.js"
    );
    const bgService = (await serviceContainer.get(
      SERVICE_NAMES.BACKGROUND_PROCESSES,
    )) as InstanceType<typeof BackgroundProcessService>;
    await bgService.cleanup();
  } catch (err) {
    logger.debug("Background process cleanup error (ignored)", err as any);
  }

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
