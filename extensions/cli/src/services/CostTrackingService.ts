import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

export interface TokenUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ModelCostEntry {
  model: string;
  usage: TokenUsageSnapshot;
  costUsd: number;
  requestCount: number;
  apiDurationMs: number;
  toolDurationMs: number;
}

export interface CostTrackingServiceState {
  totalCostUsd: number;
  totalUsage: TokenUsageSnapshot;
  perModel: Record<string, ModelCostEntry>;
  sessionStartTime: Date;
  lastUpdated: Date | null;
  unknownModelTokens: number;
}

/**
 * Model pricing table (USD per million tokens).
 * Covers input, output, cache-write, and cache-read tiers.
 */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-opus-4-6": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-3-opus": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-3-5-sonnet": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-3-5-haiku": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-3-haiku": {
    input: 0.25,
    output: 1.25,
    cacheWrite: 0.3,
    cacheRead: 0.03,
  },
  // OpenAI
  "gpt-4o": { input: 5, output: 15, cacheWrite: 0, cacheRead: 2.5 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheWrite: 0, cacheRead: 0.075 },
  "gpt-4-turbo": { input: 10, output: 30, cacheWrite: 0, cacheRead: 0 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5, cacheWrite: 0, cacheRead: 0 },
  // Gemini
  "gemini-1.5-pro": {
    input: 3.5,
    output: 10.5,
    cacheWrite: 0,
    cacheRead: 0.875,
  },
  "gemini-1.5-flash": {
    input: 0.075,
    output: 0.3,
    cacheWrite: 0,
    cacheRead: 0.01875,
  },
};

function findPricing(model: string) {
  const normalized = model.toLowerCase();
  const sortedKeys = Object.keys(MODEL_PRICING).sort(
    (a, b) => b.length - a.length,
  );
  for (const prefix of sortedKeys) {
    if (normalized.startsWith(prefix)) {
      return MODEL_PRICING[prefix];
    }
  }
  return null;
}

function calculateCost(model: string, usage: TokenUsageSnapshot): number {
  const pricing = findPricing(model);
  if (!pricing) {
    // Fallback: $1/MTok input, $2/MTok output
    return (usage.inputTokens * 1 + usage.outputTokens * 2) / 1_000_000;
  }

  return (
    (usage.inputTokens * pricing.input +
      usage.outputTokens * pricing.output +
      usage.cacheWriteTokens * pricing.cacheWrite +
      usage.cacheReadTokens * pricing.cacheRead) /
    1_000_000
  );
}

function emptyUsage(): TokenUsageSnapshot {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function addUsage(
  a: TokenUsageSnapshot,
  b: TokenUsageSnapshot,
): TokenUsageSnapshot {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

/**
 * CostTrackingService maintains a session-level aggregate of token usage and
 * inferred USD cost, broken down per model.
 *
 * Mirrors Marcel's cost-tracker.ts behaviour:
 * - Tracks cache read / cache write tokens separately
 * - Tracks API call duration vs tool execution duration
 * - Produces a formatted cost summary
 * - Detects unknown models and warns
 */
export class CostTrackingService extends BaseService<CostTrackingServiceState> {
  constructor() {
    super("CostTrackingService", {
      totalCostUsd: 0,
      totalUsage: emptyUsage(),
      perModel: {},
      sessionStartTime: new Date(),
      lastUpdated: null,
      unknownModelTokens: 0,
    });
  }

  async doInitialize(): Promise<CostTrackingServiceState> {
    this.setState({
      totalCostUsd: 0,
      totalUsage: emptyUsage(),
      perModel: {},
      sessionStartTime: new Date(),
      lastUpdated: null,
      unknownModelTokens: 0,
    });

    logger.debug("CostTrackingService initialized");
    return this.currentState;
  }

  /**
   * Record token usage for a single LLM request.
   */
  record(options: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    apiDurationMs?: number;
    toolDurationMs?: number;
  }): void {
    const {
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens = 0,
      cacheWriteTokens = 0,
      apiDurationMs = 0,
      toolDurationMs = 0,
    } = options;

    const usage: TokenUsageSnapshot = {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    };

    const pricing = findPricing(model);
    if (!pricing) {
      this.setState({
        unknownModelTokens:
          this.currentState.unknownModelTokens + inputTokens + outputTokens,
      });
      logger.warn(
        `CostTrackingService: unknown model "${model}", using fallback pricing`,
      );
    }

    const cost = calculateCost(model, usage);

    const existing = this.currentState.perModel[model] ?? {
      model,
      usage: emptyUsage(),
      costUsd: 0,
      requestCount: 0,
      apiDurationMs: 0,
      toolDurationMs: 0,
    };

    const updatedEntry: ModelCostEntry = {
      model,
      usage: addUsage(existing.usage, usage),
      costUsd: existing.costUsd + cost,
      requestCount: existing.requestCount + 1,
      apiDurationMs: existing.apiDurationMs + apiDurationMs,
      toolDurationMs: existing.toolDurationMs + toolDurationMs,
    };

    this.setState({
      totalCostUsd: this.currentState.totalCostUsd + cost,
      totalUsage: addUsage(this.currentState.totalUsage, usage),
      perModel: { ...this.currentState.perModel, [model]: updatedEntry },
      lastUpdated: new Date(),
    });

    logger.debug("CostTrackingService: recorded usage", {
      model,
      cost,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
    });
  }

  /**
   * Get a formatted text summary of session costs (similar to Marcel's formatCost).
   */
  formatSummary(): string {
    const { totalCostUsd, totalUsage, perModel, sessionStartTime } =
      this.currentState;

    const elapsed = Math.round(
      (Date.now() - sessionStartTime.getTime()) / 1000,
    );
    const models = Object.values(perModel);

    if (models.length === 0) {
      return "No LLM usage recorded this session.";
    }

    const lines: string[] = [
      `Session cost summary (${formatDuration(elapsed)}):`,
      "",
    ];

    for (const entry of models) {
      lines.push(`  Model: ${entry.model}`);
      lines.push(`    Requests : ${entry.requestCount}`);
      lines.push(
        `    Input    : ${entry.usage.inputTokens.toLocaleString()} tokens`,
      );
      lines.push(
        `    Output   : ${entry.usage.outputTokens.toLocaleString()} tokens`,
      );
      if (entry.usage.cacheReadTokens > 0) {
        lines.push(
          `    Cache-read   : ${entry.usage.cacheReadTokens.toLocaleString()} tokens`,
        );
      }
      if (entry.usage.cacheWriteTokens > 0) {
        lines.push(
          `    Cache-write  : ${entry.usage.cacheWriteTokens.toLocaleString()} tokens`,
        );
      }
      if (entry.apiDurationMs > 0) {
        lines.push(
          `    API time : ${formatDuration(Math.round(entry.apiDurationMs / 1000))}`,
        );
      }
      lines.push(`    Cost     : $${entry.costUsd.toFixed(6)}`);
      lines.push("");
    }

    lines.push(`  Total tokens:`);
    lines.push(`    Input  : ${totalUsage.inputTokens.toLocaleString()}`);
    lines.push(`    Output : ${totalUsage.outputTokens.toLocaleString()}`);
    lines.push(`  Total cost  : $${totalCostUsd.toFixed(6)}`);

    if (this.currentState.unknownModelTokens > 0) {
      lines.push(
        `  ⚠ ${this.currentState.unknownModelTokens.toLocaleString()} tokens from unknown models used fallback pricing`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Reset session counters (e.g. on /clear).
   */
  reset(): void {
    this.setState({
      totalCostUsd: 0,
      totalUsage: emptyUsage(),
      perModel: {},
      sessionStartTime: new Date(),
      lastUpdated: null,
      unknownModelTokens: 0,
    });
    logger.debug("CostTrackingService: session reset");
  }

  getTotalCostUsd(): number {
    return this.currentState.totalCostUsd;
  }

  getUsageByModel(): Record<string, ModelCostEntry> {
    return { ...this.currentState.perModel };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
