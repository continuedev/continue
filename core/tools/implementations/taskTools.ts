import type { ContextItem } from "../..";

import {
  getAgentTask,
  listAgentTasks,
  type AgentTaskStatus,
  createAgentTask,
  formatAgentTask,
  formatAgentTaskDetails,
  stopAgentTask,
  updateAgentTask,
} from "../../util/taskStore";
import { getToolSessionId } from "../../util/sessionScopedStore";

import { ToolImpl } from ".";

const TASK_STATUSES = new Set<AgentTaskStatus>([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

function requireText(value: unknown, fieldName: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function optionalText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

function normalizeIdList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function requireTaskSessionId(extras: { sessionId?: string }): string {
  const sessionId = getToolSessionId(extras);
  if (!sessionId) {
    throw new Error("Task tools require an active session.");
  }
  return sessionId;
}

function buildContextItem(
  name: string,
  description: string,
  content: string,
): ContextItem {
  return {
    name,
    description,
    content,
  };
}

export const taskCreateImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const task = await createAgentTask(sessionId, {
    subject: requireText(args?.subject, "subject"),
    description: requireText(args?.description, "description"),
    activeForm: optionalText(args?.active_form),
    owner: optionalText(args?.owner),
  });

  return [
    buildContextItem(
      "Task Created",
      `Task #${task.id}`,
      `Created task:\n${formatAgentTaskDetails(task)}`,
    ),
  ];
};

export const taskGetImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const taskId = requireText(args?.task_id, "task_id");
  const task = await getAgentTask(sessionId, taskId);

  return [
    buildContextItem(
      "Task Details",
      task ? `Task #${task.id}` : "Task not found",
      task ? formatAgentTaskDetails(task) : `Task #${taskId} not found.`,
    ),
  ];
};

export const taskListImpl: ToolImpl = async (_args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const tasks = await listAgentTasks(sessionId);
  const content =
    tasks.length === 0
      ? "No tracked tasks."
      : [
          `Tracked tasks (${tasks.length}):`,
          ...tasks.map((task) => formatAgentTask(task)),
        ].join("\n");

  return [
    buildContextItem("Tracked Tasks", `${tasks.length} task(s)`, content),
  ];
};

export const taskOutputImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const taskId = requireText(args?.task_id, "task_id");
  const task = await getAgentTask(sessionId, taskId);

  let content: string;
  if (!task) {
    content = `Task #${taskId} not found.`;
  } else if (task.output.length === 0) {
    content = `Task #${task.id} has no recorded output.`;
  } else {
    content = [`Task #${task.id} output:`, ...task.output].join("\n");
  }

  return [
    buildContextItem(
      "Task Output",
      task ? `Task #${task.id}` : "Task not found",
      content,
    ),
  ];
};

export const taskStopImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const taskId = requireText(args?.task_id, "task_id");
  const task = await stopAgentTask(
    sessionId,
    taskId,
    optionalText(args?.reason),
  );

  return [
    buildContextItem(
      "Task Stopped",
      task ? `Task #${task.id}` : "Task not found",
      task
        ? `Stopped task:\n${formatAgentTaskDetails(task)}`
        : `Task #${taskId} not found.`,
    ),
  ];
};

export const taskUpdateImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTaskSessionId(extras);
  const taskId = requireText(args?.task_id, "task_id");
  const status = optionalText(args?.status) as AgentTaskStatus | undefined;

  if (status && !TASK_STATUSES.has(status)) {
    throw new Error(`Invalid task status: ${status}`);
  }

  const task = await updateAgentTask(sessionId, taskId, {
    subject: optionalText(args?.subject),
    description: optionalText(args?.description),
    activeForm: optionalText(args?.active_form),
    status,
    owner: optionalText(args?.owner),
    addBlocks: normalizeIdList(args?.add_blocks),
    addBlockedBy: normalizeIdList(args?.add_blocked_by),
    appendOutput: optionalText(args?.append_output),
  });

  return [
    buildContextItem(
      "Task Updated",
      task ? `Task #${task.id}` : "Task not found",
      task
        ? `Updated task:\n${formatAgentTaskDetails(task)}`
        : `Task #${taskId} not found.`,
    ),
  ];
};
