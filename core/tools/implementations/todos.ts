import { ToolImpl } from ".";
import { ContextItem } from "../..";

interface TodoItem {
  text: string;
  order: number;
  id?: number;
  completed?: boolean;
}

interface TodoAction {
  type: string;
  patterns?: string[];
  url?: string;
  reason: string;
}

interface TodoArgs {
  summary: string;
  todos: TodoItem[];
  actions?: TodoAction[];
}

export const todosToolImpl: ToolImpl = async (args, extras) => {
  try {
    // Parse and validate the arguments passed by the LLM
    const todoArgs = args as TodoArgs;

    // Validate required fields
    if (!todoArgs.summary || typeof todoArgs.summary !== "string") {
      throw new Error('Missing or invalid "summary" field');
    }

    if (!Array.isArray(todoArgs.todos) || todoArgs.todos.length === 0) {
      throw new Error('Missing or invalid "todos" array');
    }

    // Validate each todo item
    todoArgs.todos.forEach((todo, index) => {
      if (!todo.text || typeof todo.text !== "string") {
        throw new Error(
          `Todo item at index ${index} is missing or has invalid "text" field`,
        );
      }
      if (typeof todo.order !== "number") {
        throw new Error(
          `Todo item at index ${index} is missing or has invalid "order" field`,
        );
      }
    });

    // Convert the validated args back to JSON string
    const jsonContent = JSON.stringify(todoArgs, null, 2);

    const contextItems: ContextItem[] = [
      {
        name: "Todo Plan",
        description: todoArgs.summary,
        content: jsonContent,
      },
    ];

    return contextItems;
  } catch (error) {
    // Return error as context item if parsing or validation fails
    const errorMessage = error instanceof Error ? error.message : String(error);
    return [
      {
        name: "Todo Plan Error",
        description: "Failed to create todo plan",
        content: `Error creating todo plan: ${errorMessage}\n\nPlease ensure the plan follows the correct format with a "summary" string and "todos" array.`,
      },
    ];
  }
};
