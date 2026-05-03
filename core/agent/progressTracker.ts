/**
 * Token-aware progress tracking for agent runs.
 *
 * Key correctness invariant (from the Claude API):
 *   - `input_tokens` in each response is *cumulative* (includes all prior context).
 *     → Keep only the *latest* value; do NOT sum across turns.
 *   - `output_tokens` is *per-turn*.
 *     → Accumulate the sum across all turns.
 *
 * Ported from Marcel (src/tasks/LocalAgentTask/LocalAgentTask.tsx).
 */

/** A single tool call that happened during the agent run. */
export type ToolActivity = {
  toolName: string;
  input: Record<string, unknown>;
  /** Optional human-readable description of what the tool did. */
  activityDescription?: string;
  /** True when this is a search operation (grep, glob, web, etc.). */
  isSearch?: boolean;
  /** True when this is a file-read operation. */
  isRead?: boolean;
};

/** Summarised progress snapshot returned to callers. */
export type AgentProgress = {
  toolUseCount: number;
  tokenCount: number;
  lastActivity?: ToolActivity;
  recentActivities?: ToolActivity[];
  summary?: string;
};

const MAX_RECENT_ACTIVITIES = 5;

export type ProgressTracker = {
  toolUseCount: number;
  /**
   * The latest *cumulative* input token count reported by the API.
   * Replace (not add) on every turn because the API includes prior context.
   */
  latestInputTokens: number;
  /** Sum of per-turn output tokens across all turns. */
  cumulativeOutputTokens: number;
  /** Sliding window of the most recent tool activities. */
  recentActivities: ToolActivity[];
};

export function createProgressTracker(): ProgressTracker {
  return {
    toolUseCount: 0,
    latestInputTokens: 0,
    cumulativeOutputTokens: 0,
    recentActivities: [],
  };
}

/**
 * Total tokens = latest cumulative input + sum of all output tokens so far.
 */
export function getTokenCountFromTracker(tracker: ProgressTracker): number {
  return tracker.latestInputTokens + tracker.cumulativeOutputTokens;
}

/**
 * Update a tracker from a raw LLM usage object and an optional list of new
 * tool calls from that turn.
 *
 * `usage` should be the `usage` field from the API response message, which
 * typically contains `input_tokens`, `output_tokens`, and optionally
 * `cache_creation_input_tokens` / `cache_read_input_tokens`.
 *
 * `toolCalls` is an optional list of tool-use blocks from the assistant turn.
 */
export function updateTrackerFromUsage(
  tracker: ProgressTracker,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  },
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
    activityDescription?: string;
    isSearch?: boolean;
    isRead?: boolean;
  }>,
): void {
  // Cumulative input — replace with the latest value.
  tracker.latestInputTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  // Per-turn output — accumulate.
  tracker.cumulativeOutputTokens += usage.output_tokens;

  if (toolCalls) {
    for (const call of toolCalls) {
      tracker.toolUseCount++;
      tracker.recentActivities.push({
        toolName: call.name,
        input: call.input,
        activityDescription: call.activityDescription,
        isSearch: call.isSearch,
        isRead: call.isRead,
      });
    }
    while (tracker.recentActivities.length > MAX_RECENT_ACTIVITIES) {
      tracker.recentActivities.shift();
    }
  }
}

/** Build a progress snapshot suitable for display or telemetry. */
export function getProgressUpdate(tracker: ProgressTracker): AgentProgress {
  return {
    toolUseCount: tracker.toolUseCount,
    tokenCount: getTokenCountFromTracker(tracker),
    lastActivity: tracker.recentActivities[tracker.recentActivities.length - 1],
    recentActivities: [...tracker.recentActivities],
  };
}
