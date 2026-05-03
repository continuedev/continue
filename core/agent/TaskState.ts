/**
 * TaskState — ported and adapted from Marcel (Yuto Code) Task.ts.
 * Provides a typed task state machine for use by AgentRunner.
 */
// TaskState.ts — use Web Crypto (available in Node 15+ and browsers)
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Task types ───────────────────────────────────────────────────────────────

export type TaskType =
  | "local_bash"
  | "local_agent"
  | "remote_agent"
  | "in_process_teammate"
  | "local_workflow";

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed";

/**
 * Returns true when a task has reached a terminal state and will not
 * transition further. Guards against injecting messages into dead tasks.
 */
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return (
    status === "completed" || status === "failed" || status === "killed"
  );
}

// ─── Task state ───────────────────────────────────────────────────────────────

export type TaskStateBase = {
  id: string;
  type: TaskType;
  status: TaskStatus;
  description: string;
  /** Tool call ID that triggered this task, if any */
  toolUseId?: string;
  startTime: number;
  endTime?: number;
  totalPausedMs?: number;
  outputOffset: number;
  notified: boolean;
};

// ─── Task ID generation ───────────────────────────────────────────────────────

const TASK_ID_PREFIXES: Record<TaskType, string> = {
  local_bash: "b",
  local_agent: "a",
  remote_agent: "r",
  in_process_teammate: "t",
  local_workflow: "w",
};

function getTaskIdPrefix(type: TaskType): string {
  return TASK_ID_PREFIXES[type] ?? "x";
}

/** Case-insensitive-safe alphabet (digits + lowercase) for task IDs. */
const TASK_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function generateTaskId(type: TaskType): string {
  const prefix = getTaskIdPrefix(type);
  return prefix + randomHex(8);
}

// ─── Task state factory ───────────────────────────────────────────────────────

export function createTaskStateBase(
  id: string,
  type: TaskType,
  description: string,
  toolUseId?: string,
): TaskStateBase {
  return {
    id,
    type,
    status: "pending",
    description,
    toolUseId,
    startTime: Date.now(),
    outputOffset: 0,
    notified: false,
  };
}

// ─── Task transitions ─────────────────────────────────────────────────────────

export function transitionTask(
  task: TaskStateBase,
  to: TaskStatus,
): TaskStateBase {
  if (isTerminalTaskStatus(task.status)) {
    throw new Error(
      `Cannot transition task ${task.id} from terminal status "${task.status}" to "${to}"`,
    );
  }
  return {
    ...task,
    status: to,
    endTime: isTerminalTaskStatus(to) ? Date.now() : task.endTime,
  };
}

// ─── Task handle ─────────────────────────────────────────────────────────────

export type TaskHandle = {
  taskId: string;
  /** Optional cleanup hook called when the task is killed or completed */
  cleanup?: () => void;
};
