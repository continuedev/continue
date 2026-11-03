import type { ToolPermissions } from "../rules";
import type { ReviewResult } from "./parse";

export const DEFAULT_CONSECUTIVE_DENIALS = 3;
export const DEFAULT_TOTAL_DENIALS = 20;
const MAX_SESSIONS = 50;
const MAX_CACHE = 200;

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * What Auto remembers within one session: refusal counts and earlier answers.
 * Kept in memory only; the prompt contains the conversation, so nothing here
 * is written to disk.
 */
export class AutoReviewState {
  private consecutive = 0;
  private total = 0;
  private cache = new Map<string, ReviewResult>();

  /** An earlier model answer for an identical call, if any. */
  cached(toolName: string, args: unknown): ReviewResult | undefined {
    return this.cache.get(`${toolName}\u0000${stableStringify(args)}`);
  }

  /** Remember an answer that came from the model (not an error or a cap). */
  remember(toolName: string, args: unknown, result: ReviewResult): void {
    if (result.category === "reviewer-unavailable") return;
    if (this.cache.size >= MAX_CACHE) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(`${toolName}\u0000${stableStringify(args)}`, result);
  }

  /**
   * Count a result against the caps. A refusal that reaches a cap becomes an
   * ask, so the agent stops and the person decides.
   */
  record(
    result: ReviewResult,
    limits: NonNullable<ToolPermissions["auto"]>["limits"] | undefined,
  ): ReviewResult {
    if (result.decision === "allow") {
      this.consecutive = 0;
      return result;
    }
    if (result.decision === "ask") return result;

    const maxConsecutive =
      limits?.consecutiveDenials ?? DEFAULT_CONSECUTIVE_DENIALS;
    const maxTotal = limits?.totalDenials ?? DEFAULT_TOTAL_DENIALS;
    this.consecutive += 1;
    this.total += 1;
    const hitConsecutive = this.consecutive >= maxConsecutive;
    const hitTotal = this.total >= maxTotal;
    if (!hitConsecutive && !hitTotal) return result;

    // Start the in-a-row count again so the person's answer is not followed by
    // an instant second stop; the total keeps counting for the session.
    this.consecutive = 0;
    return {
      decision: "ask",
      category: "denial-limit",
      reason: hitTotal
        ? `Auto has refused ${this.total} calls in this session. Last refusal (${result.category}): ${result.reason}`
        : `Auto refused ${maxConsecutive} calls in a row. Last refusal (${result.category}): ${result.reason}`,
    };
  }
}

/** One state per session id, oldest dropped past a small limit. */
export class AutoReviewSessions {
  private sessions = new Map<string, AutoReviewState>();

  get(sessionId: string): AutoReviewState {
    let s = this.sessions.get(sessionId);
    if (s) {
      this.sessions.delete(sessionId);
    } else {
      s = new AutoReviewState();
      if (this.sessions.size >= MAX_SESSIONS) {
        const oldest = this.sessions.keys().next().value;
        if (oldest !== undefined) this.sessions.delete(oldest);
      }
    }
    this.sessions.set(sessionId, s);
    return s;
  }
}
