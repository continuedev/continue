import {
  loadSessionScopedJsonState,
  saveSessionScopedJsonState,
} from "./sessionScopedStore.js";

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority: "high" | "medium" | "low";
}

const TODO_NAMESPACE = "todos";

interface TodoState {
  todos: TodoItem[];
}

const EMPTY_TODO_STATE: TodoState = {
  todos: [],
};

export async function listTodos(): Promise<TodoItem[]> {
  const state = await loadSessionScopedJsonState(
    TODO_NAMESPACE,
    EMPTY_TODO_STATE,
  );
  return state.todos;
}

export async function replaceTodos(todos: TodoItem[]): Promise<TodoItem[]> {
  const hasActiveTodos = todos.some(
    (todo) => todo.status === "pending" || todo.status === "in_progress",
  );

  const nextState: TodoState = {
    todos: hasActiveTodos ? todos : [],
  };

  await saveSessionScopedJsonState(TODO_NAMESPACE, nextState);
  return nextState.todos;
}

export function formatTodosAsChecklist(todos: TodoItem[]): string {
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
