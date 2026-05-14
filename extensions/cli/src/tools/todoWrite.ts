import {
  formatTodosAsChecklist,
  replaceTodos,
  TodoItem,
} from "../util/todoStore.js";

import { Tool } from "./types.js";

const TODO_STATUSES = new Set([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
const TODO_PRIORITIES = new Set(["high", "medium", "low"]);

function normalizeTodo(todo: TodoItem): TodoItem {
  return {
    ...todo,
    id: todo.id.trim(),
    content: todo.content.trim(),
  };
}

function validateTodos(todos: TodoItem[]): TodoItem[] {
  const ids = new Set<string>();
  let inProgressCount = 0;
  const normalizedTodos = todos.map((todo) => normalizeTodo(todo));

  for (const todo of normalizedTodos) {
    if (!todo.id) {
      throw new Error("Todo id cannot be empty");
    }

    if (!todo.content) {
      throw new Error(`Todo ${todo.id} content cannot be empty`);
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
    throw new Error("Only one todo item can be in_progress at a time");
  }

  return normalizedTodos;
}

export const todoWriteTool: Tool = {
  name: "TodoWrite",
  displayName: "TodoWrite",
  description:
    "Create and update a structured todo list for the current session.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["todos"],
    properties: {
      todos: {
        type: "array",
        description: "The complete updated todo list.",
        items: {
          type: "object",
          required: ["id", "content", "status", "priority"],
          properties: {
            id: {
              type: "string",
              description: "Stable unique identifier for the todo item.",
            },
            content: {
              type: "string",
              description: "Short action-oriented todo text.",
            },
            status: {
              type: "string",
              description:
                "One of pending, in_progress, completed, or cancelled.",
              enum: ["pending", "in_progress", "completed", "cancelled"],
            },
            priority: {
              type: "string",
              description: "One of high, medium, or low.",
              enum: ["high", "medium", "low"],
            },
          },
        },
      },
    },
  },
  preprocess: async (args: { todos: TodoItem[] }) => {
    const todos = validateTodos(args.todos);
    return {
      args: { todos },
      preview: [
        {
          type: "checklist",
          content: formatTodosAsChecklist(todos),
        },
      ],
    };
  },
  run: async (args: { todos: TodoItem[] }): Promise<string> => {
    const normalizedTodos = validateTodos(args.todos);
    const todos = await replaceTodos(normalizedTodos);
    return formatTodosAsChecklist(todos);
  },
};
