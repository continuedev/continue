/**
 * TaskStateService — agent task lifecycle management.
 *
 * Ported and adapted from core/agent/TaskState.ts for the Continue CLI.
 *
 * Each user prompt creates a task that transitions through:
 *   pending → running → completed | failed | killed
 *
 * Maintains a sliding history of the last 20 tasks for the /status command.
 */

import { logger } from "../util/logger.js";

import { BaseService } from "./BaseService.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TaskType =
  | "chat" // normal interactive turn
  | "agent" // auto/plan mode autonomous run
  | "skill" // skill execution
  | "compact"; // compaction pass

export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "killed";

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "killed";
}

export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  description: string;
  startTime: number;
  endTime?: number;
  /** Number of tool calls executed in this task */
  toolCallCount: number;
  /** Approximate tokens consumed (input at end of task) */
  tokensUsed: number;
}

// ─── ID generation ─────────────────────────────────────────────────────────────

const TYPE_PREFIX: Record<TaskType, string> = {
  chat: "c",
  agent: "a",
  skill: "s",
  compact: "x",
};

function generateTaskId(type: TaskType): string {
  const prefix = TYPE_PREFIX[type] ?? "t";
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${rand}`;
}

// ─── State ─────────────────────────────────────────────────────────────────────

export interface TaskStateServiceState {
  currentTask: TaskRecord | null;
  taskHistory: TaskRecord[];
  sessionTaskCount: number;
  sessionStartTime: number;
}

const MAX_HISTORY = 20;

// ─── Service ──────────────────────────────────────────────────────────────────

export class TaskStateService extends BaseService<TaskStateServiceState> {
  constructor() {
    super("TaskStateService", {
      currentTask: null,
      taskHistory: [],
      sessionTaskCount: 0,
      sessionStartTime: Date.now(),
    });
  }

  async doInitialize(): Promise<TaskStateServiceState> {
    return this.currentState;
  }

  /** Create a new task for the given user prompt */
  createTask(description: string, type: TaskType = "chat"): TaskRecord {
    const task: TaskRecord = {
      id: generateTaskId(type),
      type,
      status: "pending",
      description: description.slice(0, 120),
      startTime: Date.now(),
      toolCallCount: 0,
      tokensUsed: 0,
    };
    this.setState({ currentTask: task });
    logger.debug("TaskStateService: task created", { id: task.id, type });
    return task;
  }

  /** Transition the current task to "running" */
  startCurrentTask(): void {
    const task = this.currentState.currentTask;
    if (!task || isTerminalStatus(task.status)) return;
    this.setState({
      currentTask: { ...task, status: "running" },
      sessionTaskCount: this.currentState.sessionTaskCount + 1,
    });
  }

  /** Record that a tool call occurred in the current task */
  recordToolCall(): void {
    const task = this.currentState.currentTask;
    if (!task) return;
    this.setState({
      currentTask: { ...task, toolCallCount: task.toolCallCount + 1 },
    });
  }

  /** Update the token usage estimate for the current task */
  updateTokens(inputTokens: number): void {
    const task = this.currentState.currentTask;
    if (!task) return;
    this.setState({
      currentTask: { ...task, tokensUsed: inputTokens },
    });
  }

  /** Complete the current task */
  completeTask(): void {
    this.transitionCurrent("completed");
  }

  /** Mark the current task as failed */
  failTask(): void {
    this.transitionCurrent("failed");
  }

  /** Mark the current task as killed (aborted) */
  killTask(): void {
    this.transitionCurrent("killed");
  }

  /** Reset for a new session (/clear) */
  newSession(): void {
    const current = this.currentState.currentTask;
    if (current && !isTerminalStatus(current.status)) {
      this.transitionCurrent("killed");
    }
    this.setState({
      currentTask: null,
      taskHistory: [],
      sessionTaskCount: 0,
      sessionStartTime: Date.now(),
    });
  }

  getCurrentTask(): TaskRecord | null {
    return this.currentState.currentTask;
  }

  /** Format a status summary for /status */
  formatStatus(): string {
    const { currentTask, taskHistory, sessionTaskCount, sessionStartTime } =
      this.currentState;

    const lines: string[] = [];
    const elapsed = Math.round((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const elapsedStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    lines.push(`Session: ${elapsedStr} elapsed, ${sessionTaskCount} tasks`);
    lines.push("");

    if (currentTask) {
      lines.push(`Current task (${currentTask.id}):`);
      lines.push(
        `  Status:      ${statusIcon(currentTask.status)} ${currentTask.status}`,
      );
      lines.push(`  Type:        ${currentTask.type}`);
      lines.push(`  Description: ${currentTask.description}`);
      lines.push(`  Tool calls:  ${currentTask.toolCallCount}`);
      if (currentTask.tokensUsed > 0) {
        lines.push(`  Tokens used: ${currentTask.tokensUsed.toLocaleString()}`);
      }
      const taskElapsed = Math.round(
        (Date.now() - currentTask.startTime) / 1000,
      );
      lines.push(`  Elapsed:     ${taskElapsed}s`);
    } else {
      lines.push("No active task.");
    }

    const recentHistory = taskHistory.slice(-5);
    if (recentHistory.length > 0) {
      lines.push("");
      lines.push("Recent tasks:");
      for (const t of recentHistory.reverse()) {
        const duration = t.endTime
          ? `${Math.round((t.endTime - t.startTime) / 1000)}s`
          : "—";
        lines.push(
          `  ${statusIcon(t.status)} ${t.id}  ${t.type.padEnd(8)}  ${duration.padStart(5)}  ${t.description}`,
        );
      }
    }

    return lines.join("\n");
  }

  private transitionCurrent(to: TaskStatus): void {
    const task = this.currentState.currentTask;
    if (!task || isTerminalStatus(task.status)) return;

    const completed: TaskRecord = { ...task, status: to, endTime: Date.now() };
    const history = [...this.currentState.taskHistory, completed].slice(
      -MAX_HISTORY,
    );
    this.setState({ currentTask: null, taskHistory: history });
    logger.debug("TaskStateService: task finished", {
      id: task.id,
      status: to,
    });
  }
}

function statusIcon(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "⏳";
    case "running":
      return "▶";
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    case "killed":
      return "⊘";
    default:
      return "?";
  }
}
