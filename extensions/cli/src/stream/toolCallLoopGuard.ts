import type { ToolCall } from "../tools/types.js";

/** The number of times an identical tool-call batch may run in one turn. */
export const DEFAULT_MAX_IDENTICAL_TOOL_CALLS = 2;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }

  return value;
}

/**
 * Builds a stable fingerprint for a tool-call batch.
 * Call IDs are intentionally excluded because providers may generate a new ID
 * when they repeat the same operation.
 */
export function getToolCallFingerprint(toolCalls: readonly ToolCall[]): string {
  return JSON.stringify(
    toolCalls.map((toolCall) => [
      toolCall.name,
      canonicalize(toolCall.arguments),
    ]),
  );
}

export interface ToolCallLoopGuardResult {
  count: number;
  fingerprint: string;
  blocked: boolean;
}

/** Tracks consecutive identical tool-call batches within one agent turn. */
export class ToolCallLoopGuard {
  private lastFingerprint: string | undefined;
  private identicalCount = 0;

  constructor(
    private readonly maxIdenticalToolCalls = DEFAULT_MAX_IDENTICAL_TOOL_CALLS,
  ) {
    if (!Number.isInteger(maxIdenticalToolCalls) || maxIdenticalToolCalls < 1) {
      throw new Error("maxIdenticalToolCalls must be a positive integer");
    }
  }

  observe(toolCalls: readonly ToolCall[]): ToolCallLoopGuardResult {
    if (toolCalls.length === 0) {
      this.lastFingerprint = undefined;
      this.identicalCount = 0;
      return { count: 0, fingerprint: "", blocked: false };
    }

    const fingerprint = getToolCallFingerprint(toolCalls);
    if (fingerprint === this.lastFingerprint) {
      this.identicalCount += 1;
    } else {
      this.lastFingerprint = fingerprint;
      this.identicalCount = 1;
    }

    return {
      count: this.identicalCount,
      fingerprint,
      blocked: this.identicalCount > this.maxIdenticalToolCalls,
    };
  }
}
