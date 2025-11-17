import { CodeExecutionConfig } from "../..";
import { ContinueError, ContinueErrorReason } from "../../util/errors";

export type EffectiveCodeExecutionConfig = {
  enabled: boolean;
  e2bApiKey?: string;
  sessionTimeoutMinutes: number;
  maxExecutionTimeSeconds: number;
  requestTimeoutSeconds: number;
  maxOutputSizeChars: number;
  rateLimit: {
    maxExecutionsPerMinute: number;
  };
  requireFirstUseConfirmation: boolean;
};

const DEFAULT_CONFIG: EffectiveCodeExecutionConfig = {
  enabled: false,
  sessionTimeoutMinutes: 30,
  maxExecutionTimeSeconds: 60,
  requestTimeoutSeconds: 120,
  maxOutputSizeChars: 10_000,
  rateLimit: {
    maxExecutionsPerMinute: 10,
  },
  requireFirstUseConfirmation: true,
};

const FALLBACK_CONVERSATION_ID = "__global__";

export function resolveCodeExecutionConfig(
  config?: CodeExecutionConfig,
): EffectiveCodeExecutionConfig {
  if (!config) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    enabled: Boolean(config.enabled),
    e2bApiKey: config.e2bApiKey,
    sessionTimeoutMinutes:
      config.sessionTimeoutMinutes ?? DEFAULT_CONFIG.sessionTimeoutMinutes,
    maxExecutionTimeSeconds:
      config.maxExecutionTimeSeconds ?? DEFAULT_CONFIG.maxExecutionTimeSeconds,
    requestTimeoutSeconds:
      config.requestTimeoutSeconds ?? DEFAULT_CONFIG.requestTimeoutSeconds,
    maxOutputSizeChars:
      config.maxOutputSizeChars ?? DEFAULT_CONFIG.maxOutputSizeChars,
    rateLimit: {
      maxExecutionsPerMinute:
        config.rateLimit?.maxExecutionsPerMinute ??
        DEFAULT_CONFIG.rateLimit.maxExecutionsPerMinute,
    },
    requireFirstUseConfirmation:
      config.requireFirstUseConfirmation ??
      DEFAULT_CONFIG.requireFirstUseConfirmation,
  };
}

class ExecuteCodePolicyManager {
  private confirmedConversations = new Set<string>();
  private executionHistory = new Map<string, number[]>();

  shouldRequireConfirmation(
    conversationId: string | undefined,
    requireFirstUseConfirmation: boolean,
  ): boolean {
    if (!requireFirstUseConfirmation) {
      return false;
    }

    const key = this.normalizeConversationId(conversationId);
    return !this.confirmedConversations.has(key);
  }

  registerExecutionAttempt(
    conversationId: string | undefined,
    maxExecutionsPerMinute: number,
  ) {
    const key = this.normalizeConversationId(conversationId);
    const now = Date.now();
    const windowStart = now - 60_000;
    const recentExecutions = (this.executionHistory.get(key) ?? []).filter(
      (timestamp) => timestamp >= windowStart,
    );

    if (recentExecutions.length >= maxExecutionsPerMinute) {
      throw new ContinueError(
        ContinueErrorReason.Unspecified,
        `Code execution rate limit exceeded. A maximum of ${maxExecutionsPerMinute} executions per minute are allowed per conversation.`,
      );
    }

    recentExecutions.push(now);
    this.executionHistory.set(key, recentExecutions);
    this.confirmedConversations.add(key);

    // Clean up stale entries periodically
    if (this.executionHistory.size > 1000) {
      for (const [id, timestamps] of this.executionHistory.entries()) {
        if (timestamps.every((ts) => ts < windowStart)) {
          this.executionHistory.delete(id);
        }
      }
    }
  }

  clearConversation(conversationId: string | undefined) {
    const key = this.normalizeConversationId(conversationId);
    this.executionHistory.delete(key);
    this.confirmedConversations.delete(key);
  }

  private normalizeConversationId(conversationId: string | undefined) {
    return conversationId ?? FALLBACK_CONVERSATION_ID;
  }
}

export const executeCodePolicy = new ExecuteCodePolicyManager();
