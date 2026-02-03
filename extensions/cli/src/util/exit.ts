import type { ChatHistoryItem } from "core/index.js";

import { sentryService } from "../sentry.js";
import { getSessionUsage } from "../session.js";
import { telemetryService } from "../telemetry/telemetryService.js";

import { hadUnhandledError } from "./errorState.js";
import { getGitDiffSnapshot } from "./git.js";
import { logger } from "./logger.js";
import {
  calculateDiffStats,
  extractSummary,
  getAgentIdFromArgs,
  postAgentMetadata,
} from "./metadata.js";

/**
 * Options for updating agent metadata
 */
export interface UpdateAgentMetadataOptions {
  /** Chat history to extract summary from */
  history?: ChatHistoryItem[];
  /** Set to true when the agent is exiting/completing */
  isComplete?: boolean;
}

/**
 * Collect diff stats and add to metadata
 * @returns Whether there were any changes
 */
async function collectDiffStats(
  metadata: Record<string, any>,
): Promise<boolean> {
  try {
    const { diff, repoFound } = await getGitDiffSnapshot();
    if (repoFound && diff) {
      const { additions, deletions } = calculateDiffStats(diff);
      if (additions > 0 || deletions > 0) {
        metadata.additions = additions;
        metadata.deletions = deletions;
        return true;
      }
    }
  } catch (err) {
    logger.debug("Failed to calculate diff stats (non-critical)", err as any);
  }
  return false;
}

/**
 * Extract summary from conversation history and add to metadata
 */
function collectSummary(
  metadata: Record<string, any>,
  history: ChatHistoryItem[] | undefined,
): void {
  if (!history || history.length === 0) {
    return;
  }
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

/**
 * Extract session usage and add to metadata
 */
function collectSessionUsage(metadata: Record<string, any>): void {
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
}

/**
 * Update agent session metadata in control plane
 * Collects diff stats and conversation summary, posts to control plane
 * This is called both during execution (after each turn) and before exit
 *
 * @param options - Options including history and completion state
 */
export async function updateAgentMetadata(
  options?: ChatHistoryItem[] | UpdateAgentMetadataOptions,
): Promise<void> {
  // Support both old signature (history array) and new signature (options object)
  const { history, isComplete } = Array.isArray(options)
    ? { history: options, isComplete: false }
    : { history: options?.history, isComplete: options?.isComplete ?? false };

  try {
    const agentId = getAgentIdFromArgs();
    if (!agentId) {
      logger.debug("No agent ID found, skipping metadata update");
      return;
    }

    const metadata: Record<string, any> = {};
    const hasChanges = await collectDiffStats(metadata);

    if (isComplete) {
      metadata.isComplete = true;
      metadata.hasChanges = hasChanges;
    }

    collectSummary(metadata, history);
    collectSessionUsage(metadata);

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
 *
 * If any unhandled errors occurred during execution and the requested
 * exit code is 0 (success), this will exit with code 1 instead to
 * signal that the process encountered errors.
 */
export async function gracefulExit(code: number = 0): Promise<void> {
  // Display session usage breakdown in verbose mode
  displaySessionUsage();

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

  // If we're trying to exit with success (0) but had unhandled errors,
  // exit with 1 instead to signal failure
  const finalCode = code === 0 && hadUnhandledError() ? 1 : code;

  // Exit the process
  process.exit(finalCode);
}
