export type TaskNotificationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed"
  | "stalled";

export type TaskNotificationKind =
  | "shell"
  | "subagent"
  | "workflow"
  | "compact"
  | "dream"
  | "other";

export interface TaskNotificationUsage {
  totalTokens?: number;
  toolUses?: number;
  durationMs?: number;
}

export interface TaskNotification {
  id: string;
  status: TaskNotificationStatus;
  kind: TaskNotificationKind;
  summary: string;
  description?: string;
  toolUseId?: string;
  outputFile?: string;
  usage?: TaskNotificationUsage;
  metadata?: Record<string, unknown>;
}

export function isTerminalTaskNotificationStatus(
  status: TaskNotificationStatus,
): boolean {
  return status === "completed" || status === "failed" || status === "killed";
}
