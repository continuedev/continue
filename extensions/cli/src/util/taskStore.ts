import {
  loadSessionScopedJsonState,
  saveSessionScopedJsonState,
} from "./sessionScopedStore.js";

export type AgentTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentTask {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  status: AgentTaskStatus;
  blocks: string[];
  blockedBy: string[];
  output: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface AgentTaskState {
  nextId: number;
  tasks: AgentTask[];
}

const TASK_NAMESPACE = "tasks";

const EMPTY_TASK_STATE: AgentTaskState = {
  nextId: 1,
  tasks: [],
};

async function loadTaskState(): Promise<AgentTaskState> {
  return loadSessionScopedJsonState(TASK_NAMESPACE, EMPTY_TASK_STATE);
}

async function saveTaskState(state: AgentTaskState): Promise<void> {
  await saveSessionScopedJsonState(TASK_NAMESPACE, state);
}

function mergeUnique(
  values: string[] | undefined,
  existing: string[],
): string[] {
  if (!values || values.length === 0) {
    return existing;
  }

  return Array.from(new Set([...existing, ...values]));
}

export async function listAgentTasks(): Promise<AgentTask[]> {
  const state = await loadTaskState();
  return [...state.tasks].sort(
    (left, right) => Number(left.id) - Number(right.id),
  );
}

export async function getAgentTask(taskId: string): Promise<AgentTask | null> {
  const tasks = await listAgentTasks();
  return tasks.find((task) => task.id === taskId) ?? null;
}

export async function createAgentTask(input: {
  subject: string;
  description: string;
  activeForm?: string;
  owner?: string;
  metadata?: Record<string, unknown>;
}): Promise<AgentTask> {
  const state = await loadTaskState();
  const now = Date.now();
  const task: AgentTask = {
    id: String(state.nextId),
    subject: input.subject,
    description: input.description,
    activeForm: input.activeForm,
    owner: input.owner,
    status: "pending",
    blocks: [],
    blockedBy: [],
    output: [],
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };

  state.nextId += 1;
  state.tasks.push(task);
  await saveTaskState(state);
  return task;
}

export async function updateAgentTask(
  taskId: string,
  updates: Partial<
    Pick<
      AgentTask,
      "subject" | "description" | "activeForm" | "owner" | "status" | "metadata"
    >
  > & {
    addBlocks?: string[];
    addBlockedBy?: string[];
    appendOutput?: string;
  },
): Promise<AgentTask | null> {
  const state = await loadTaskState();
  const taskIndex = state.tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    return null;
  }

  const task = state.tasks[taskIndex];
  const nextTask: AgentTask = {
    ...task,
    subject: updates.subject ?? task.subject,
    description: updates.description ?? task.description,
    activeForm: updates.activeForm ?? task.activeForm,
    owner: updates.owner ?? task.owner,
    status: updates.status ?? task.status,
    metadata:
      updates.metadata === undefined
        ? task.metadata
        : { ...(task.metadata ?? {}), ...updates.metadata },
    blocks: mergeUnique(updates.addBlocks, task.blocks),
    blockedBy: mergeUnique(updates.addBlockedBy, task.blockedBy),
    output:
      updates.appendOutput && updates.appendOutput.trim().length > 0
        ? [...task.output, updates.appendOutput]
        : task.output,
    updatedAt: Date.now(),
  };

  state.tasks[taskIndex] = nextTask;
  await saveTaskState(state);
  return nextTask;
}

export async function stopAgentTask(
  taskId: string,
  reason?: string,
): Promise<AgentTask | null> {
  return updateAgentTask(taskId, {
    status: "cancelled",
    appendOutput: reason ? `Stopped: ${reason}` : undefined,
  });
}

export function formatAgentTask(task: AgentTask): string {
  const blocks =
    task.blocks.length > 0 ? ` blocks=[${task.blocks.join(", ")}]` : "";
  const blockedBy =
    task.blockedBy.length > 0
      ? ` blockedBy=[${task.blockedBy.join(", ")}]`
      : "";
  const owner = task.owner ? ` owner=${task.owner}` : "";
  return `#${task.id} [${task.status}] ${task.subject}${owner}${blocks}${blockedBy}`;
}

export function formatAgentTaskDetails(task: AgentTask): string {
  const lines = [formatAgentTask(task), `Description: ${task.description}`];

  if (task.activeForm) {
    lines.push(`Active: ${task.activeForm}`);
  }

  if (task.blocks.length > 0) {
    lines.push(`Blocks: ${task.blocks.join(", ")}`);
  }

  if (task.blockedBy.length > 0) {
    lines.push(`Blocked by: ${task.blockedBy.join(", ")}`);
  }

  if (task.metadata && Object.keys(task.metadata).length > 0) {
    lines.push(`Metadata: ${JSON.stringify(task.metadata)}`);
  }

  if (task.output.length > 0) {
    lines.push("Output:");
    lines.push(...task.output.map((entry) => `- ${entry}`));
  }

  return lines.join("\n");
}
