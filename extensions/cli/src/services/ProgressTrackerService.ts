/**
 * ProgressTrackerService — per-session tool activity and token tracking.
 *
 * Ported and adapted from core/agent/progressTracker.ts for the Continue CLI.
 *
 * Key correctness invariant (Claude API):
 *   - `prompt_tokens` in each response is CUMULATIVE (includes all prior context).
 *     → Replace with latest value; do NOT sum.
 *   - `completion_tokens` is per-turn.
 *     → Accumulate the sum across all turns.
 *
 * Tracks:
 *  - Total tool calls this session
 *  - Token usage (input cumulative, output accumulated)
 *  - Sliding window of the last 10 tool activities
 *  - Session duration
 *
 * Surfaced via /status slash command.
 */

import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ToolActivity {
  toolName: string;
  /** Stringified arguments (truncated) */
  argsSummary: string;
  timestamp: number;
  /** Rough categorisation */
  category: "read" | "write" | "search" | "shell" | "other";
}

export interface ProgressTrackerState {
  /** Total tool calls this session */
  totalToolCalls: number;
  /**
   * Latest CUMULATIVE input tokens from the API.
   * Replace on every response (not additive).
   */
  latestInputTokens: number;
  /**
   * Sum of per-turn output tokens across all turns.
   * Additive across turns.
   */
  cumulativeOutputTokens: number;
  /** Cached read tokens (latest value — cumulative) */
  latestCacheReadTokens: number;
  /** Created write tokens (latest value — cumulative) */
  latestCacheWriteTokens: number;
  /** Sliding window of recent tool activities */
  recentActivities: ToolActivity[];
  /** Number of LLM turns completed */
  turnCount: number;
  /** Session start time */
  sessionStartTime: number;
}

const MAX_RECENT_ACTIVITIES = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const READ_TOOLS = new Set([
  "read_file",
  "read_existing_file",
  "read_currently_open_file",
  "view_file",
  "view_image",
  "cat",
  "list_dir",
]);
const WRITE_TOOLS = new Set([
  "write_file",
  "create_file",
  "replace_string_in_file",
  "multi_replace_string_in_file",
  "edit_file",
  "delete_file",
  "rename",
]);
const SEARCH_TOOLS = new Set([
  "grep_search",
  "file_search",
  "semantic_search",
  "search",
  "run_search",
  "find",
]);
const SHELL_TOOLS = new Set(["run_in_terminal", "bash", "shell", "exec"]);

function categorizeToolName(name: string): ToolActivity["category"] {
  if (READ_TOOLS.has(name)) return "read";
  if (WRITE_TOOLS.has(name)) return "write";
  if (SEARCH_TOOLS.has(name)) return "search";
  if (SHELL_TOOLS.has(name)) return "shell";
  return "other";
}

function summarizeArgs(argsStr: string): string {
  try {
    const args = JSON.parse(argsStr);
    const interesting = [
      args.filepath ?? args.file_path ?? args.path ?? args.filename,
      args.query ?? args.pattern ?? args.command,
    ].filter(Boolean);
    if (interesting.length > 0) {
      return String(interesting[0]).slice(0, 60);
    }
  } catch {
    // Raw string
  }
  return argsStr.slice(0, 60);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ProgressTrackerService extends BaseService<ProgressTrackerState> {
  constructor() {
    super("ProgressTrackerService", {
      totalToolCalls: 0,
      latestInputTokens: 0,
      cumulativeOutputTokens: 0,
      latestCacheReadTokens: 0,
      latestCacheWriteTokens: 0,
      recentActivities: [],
      turnCount: 0,
      sessionStartTime: Date.now(),
    });
  }

  async doInitialize(): Promise<ProgressTrackerState> {
    return this.currentState;
  }

  /**
   * Update token counts from an LLM API response.
   * Must be called AFTER each processStreamingResponse() call.
   *
   * @param usage  The `usage` field from the API response (openai format)
   */
  updateFromUsage(
    usage:
      | {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: {
            cache_read_tokens?: number;
            cached_tokens?: number;
          };
          usage_details?: { cache_creation_input_tokens?: number };
        }
      | null
      | undefined,
  ): void {
    if (!usage) return;
    try {
      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;
      const cacheRead =
        usage.prompt_tokens_details?.cache_read_tokens ??
        usage.prompt_tokens_details?.cached_tokens ??
        0;

      this.setState({
        latestInputTokens: inputTokens,
        cumulativeOutputTokens:
          this.currentState.cumulativeOutputTokens + outputTokens,
        latestCacheReadTokens: cacheRead,
        turnCount: this.currentState.turnCount + 1,
      });
    } catch (err) {
      logger.debug("ProgressTrackerService: updateFromUsage error", {
        error: String(err),
      });
    }
  }

  /**
   * Record tool calls executed in the current turn.
   * Call once per turn with all tool calls from that turn.
   */
  recordToolCalls(
    toolCalls: Array<{
      name: string;
      arguments?: string | Record<string, unknown>;
    }>,
  ): void {
    if (toolCalls.length === 0) return;

    const activities: ToolActivity[] = toolCalls.map((tc) => {
      const argsStr =
        typeof tc.arguments === "string"
          ? tc.arguments
          : JSON.stringify(tc.arguments ?? {});
      return {
        toolName: tc.name,
        argsSummary: summarizeArgs(argsStr),
        timestamp: Date.now(),
        category: categorizeToolName(tc.name),
      };
    });

    const allActivities = [
      ...this.currentState.recentActivities,
      ...activities,
    ].slice(-MAX_RECENT_ACTIVITIES);

    this.setState({
      totalToolCalls: this.currentState.totalToolCalls + toolCalls.length,
      recentActivities: allActivities,
    });
  }

  /** Get the current estimated total token count for display */
  getTotalTokens(): number {
    return (
      this.currentState.latestInputTokens +
      this.currentState.cumulativeOutputTokens
    );
  }

  /** Reset for a new session (/clear) */
  newSession(): void {
    this.setState({
      totalToolCalls: 0,
      latestInputTokens: 0,
      cumulativeOutputTokens: 0,
      latestCacheReadTokens: 0,
      latestCacheWriteTokens: 0,
      recentActivities: [],
      turnCount: 0,
      sessionStartTime: Date.now(),
    });
  }

  /** Format a progress summary for /status */
  formatProgress(): string {
    const {
      totalToolCalls,
      latestInputTokens,
      cumulativeOutputTokens,
      latestCacheReadTokens,
      recentActivities,
      turnCount,
      sessionStartTime,
    } = this.currentState;

    const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const elapsedStr = minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
    const totalTokens = latestInputTokens + cumulativeOutputTokens;

    const lines: string[] = [];
    lines.push("Progress:");
    lines.push(`  Session time:   ${elapsedStr}`);
    lines.push(`  LLM turns:      ${turnCount}`);
    lines.push(`  Tool calls:     ${totalToolCalls}`);
    lines.push(`  Tokens (total): ${totalTokens.toLocaleString()}`);
    if (latestInputTokens > 0) {
      lines.push(
        `    Input:        ${latestInputTokens.toLocaleString()} (latest cumulative)`,
      );
    }
    if (cumulativeOutputTokens > 0) {
      lines.push(
        `    Output:       ${cumulativeOutputTokens.toLocaleString()} (session total)`,
      );
    }
    if (latestCacheReadTokens > 0) {
      lines.push(`    Cache reads:  ${latestCacheReadTokens.toLocaleString()}`);
    }

    if (recentActivities.length > 0) {
      lines.push("");
      lines.push("Recent tool activity:");
      const recent = [...recentActivities].slice(-5).reverse();
      for (const a of recent) {
        const icon = categoryIcon(a.category);
        const time = new Date(a.timestamp).toLocaleTimeString();
        lines.push(
          `  ${icon} ${a.toolName.padEnd(28)} ${a.argsSummary}  ${time}`,
        );
      }
    }

    return lines.join("\n");
  }
}

function categoryIcon(cat: ToolActivity["category"]): string {
  switch (cat) {
    case "read":
      return "📖";
    case "write":
      return "✏️ ";
    case "search":
      return "🔍";
    case "shell":
      return "💻";
    default:
      return "⚙️ ";
  }
}
