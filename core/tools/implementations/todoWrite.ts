import { ToolImpl } from ".";
import type { ContextItem } from "../..";
import type { TodoItem, TodoStatus } from "../definitions/todoWrite";

import {
  deleteSessionScopedJsonState,
  getToolSessionId,
  saveSessionScopedJsonState,
} from "../../util/sessionScopedStore";

type TodoPriority = "high" | "medium" | "low";
const TODO_NAMESPACE = "todos";

interface TodoState {
  todos: TodoItem[];
}

const TODO_STATUSES = new Set<TodoStatus>([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
const TODO_PRIORITIES = new Set<TodoPriority>(["high", "medium", "low"]);

function formatTodosAsChecklist(todos: TodoItem[]): string {
  if (todos.length === 0) {
    return "(empty todo list)";
  }

  return todos
    .map((todo) => {
      const checked =
        todo.status === "completed" || todo.status === "cancelled" ? "x" : " ";
      return `- [${checked}] ${todo.content} (${todo.status}, ${todo.priority})`;
    })
    .join("\n");
}

function normalizeTodo(todo: Record<string, unknown>): TodoItem {
  return {
    id: typeof todo.id === "string" ? todo.id.trim() : "",
    content: typeof todo.content === "string" ? todo.content.trim() : "",
    status: todo.status as TodoStatus,
    priority: todo.priority as TodoPriority,
  };
}

function validateTodos(input: unknown): TodoItem[] {
  if (!Array.isArray(input)) {
    throw new Error("TodoWrite requires a todos array.");
  }

  const todos = input.map((todo) =>
    normalizeTodo((todo ?? {}) as Record<string, unknown>),
  );
  const ids = new Set<string>();
  let inProgressCount = 0;

  for (const todo of todos) {
    if (!todo.id) {
      throw new Error("Todo id cannot be empty.");
    }

    if (!todo.content) {
      throw new Error(`Todo ${todo.id} content cannot be empty.`);
    }

    if (!TODO_STATUSES.has(todo.status)) {
      throw new Error(`Invalid todo status: ${todo.status}`);
    }

    if (!TODO_PRIORITIES.has(todo.priority)) {
      throw new Error(`Invalid todo priority: ${todo.priority}`);
    }

    if (ids.has(todo.id)) {
      throw new Error(`Duplicate todo id: ${todo.id}`);
    }

    ids.add(todo.id);

    if (todo.status === "in_progress") {
      inProgressCount += 1;
    }
  }

  if (inProgressCount > 1) {
    throw new Error("Only one todo item can be in_progress at a time.");
  }

  return todos;
}

function buildTodoContextItem(todos: TodoItem[]): ContextItem {
  return {
    name: "Todo List",
    description: "Updated todo list",
    content: formatTodosAsChecklist(todos),
  };
}

async function persistTodosForSession(
  todos: TodoItem[],
  sessionId: string | null,
): Promise<void> {
  if (!sessionId) {
    return;
  }

  const hasActiveTodos = todos.some(
    (todo) => todo.status === "pending" || todo.status === "in_progress",
  );

  if (!hasActiveTodos) {
    await deleteSessionScopedJsonState(TODO_NAMESPACE, sessionId);
    return;
  }

  const nextState: TodoState = { todos };
  await saveSessionScopedJsonState(TODO_NAMESPACE, sessionId, nextState);
}

export const todoWriteImpl: ToolImpl = async (args, extras) => {
  const todos = validateTodos(args?.todos);
  await persistTodosForSession(todos, getToolSessionId(extras));
  return [buildTodoContextItem(todos)];
};

export const __testing__ = {
  formatTodosAsChecklist,
  normalizeTodo,
  persistTodosForSession,
  validateTodos,
};
