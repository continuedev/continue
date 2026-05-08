export type TurnLifecyclePhase =
  | "turn-start"
  | "after-assistant-response"
  | "after-tool-batch"
  | "turn-end"
  | "session-end";

export interface TurnLifecycleMetrics {
  turn: number;
  toolCallCount?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TurnLifecycleContext<Message = unknown> {
  phase: TurnLifecyclePhase;
  sessionId: string;
  messages: readonly Message[];
  metrics: TurnLifecycleMetrics;
  metadata?: Record<string, unknown>;
}

export interface TurnLifecycleResult {
  blocked?: boolean;
  messages?: unknown[];
  metadata?: Record<string, unknown>;
}

export type TurnLifecycleHandler<Message = unknown> = (
  context: TurnLifecycleContext<Message>,
) => Promise<TurnLifecycleResult | void> | TurnLifecycleResult | void;
