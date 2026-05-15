import {
  ChevronDownIcon,
  ChevronRightIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { useMemo, useState } from "react";

type HistoryEntryWithToolCalls = {
  message: {
    role: string;
  };
  toolCallStates?: ToolCallState[];
};

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type TodoEntry = {
  id: string;
  content: string;
  status: TodoStatus;
};

const VALID_STATUSES = new Set<TodoStatus>([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

function normalizeStatus(value: unknown): TodoStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  return VALID_STATUSES.has(value as TodoStatus) ? (value as TodoStatus) : null;
}

function parseTodosFromArgs(toolCallState: ToolCallState): TodoEntry[] {
  const args = toolCallState.parsedArgs as { todos?: unknown } | undefined;
  if (!Array.isArray(args?.todos)) {
    return [];
  }

  return args.todos
    .map((todo, idx) => {
      if (!todo || typeof todo !== "object") {
        return null;
      }

      const candidate = todo as Record<string, unknown>;
      const id =
        typeof candidate.id === "string" && candidate.id.trim().length > 0
          ? candidate.id.trim()
          : `todo-${idx + 1}`;
      const content =
        typeof candidate.content === "string" ? candidate.content.trim() : "";
      const status = normalizeStatus(candidate.status);

      if (!content || !status) {
        return null;
      }

      return {
        id,
        content,
        status,
      };
    })
    .filter((todo): todo is TodoEntry => todo !== null);
}

function parseTodoLine(line: string, index: number): TodoEntry | null {
  const match = line.match(/^\-\s\[(x|\s)\]\s(.+?)\s\(([^,]+),\s[^)]+\)$/i);
  if (!match || !match[2] || !match[3]) {
    return null;
  }

  const content = match[2].trim();
  const status = normalizeStatus(match[3].trim());
  if (!content || !status) {
    return null;
  }

  return {
    id: `todo-output-${index + 1}`,
    content,
    status,
  };
}

function parseTodosFromOutput(toolCallState: ToolCallState): TodoEntry[] {
  const todoOutput = toolCallState.output?.find(
    (item) => item.name === "Todo List",
  );
  if (!todoOutput?.content || typeof todoOutput.content !== "string") {
    return [];
  }

  return todoOutput.content
    .split(/\r?\n/)
    .map((line, index) => parseTodoLine(line.trim(), index))
    .filter((todo): todo is TodoEntry => todo !== null);
}

export function getTodosFromTodoToolCall(
  toolCallState: ToolCallState | undefined,
): TodoEntry[] {
  if (!toolCallState) {
    return [];
  }

  const parsedFromArgs = parseTodosFromArgs(toolCallState);
  if (parsedFromArgs.length > 0) {
    return parsedFromArgs;
  }

  return parseTodosFromOutput(toolCallState);
}

export function getActiveTodoTaskLabel(
  toolCallState: ToolCallState | undefined,
): string | null {
  const todos = getTodosFromTodoToolCall(toolCallState);
  if (todos.length === 0) {
    return null;
  }

  const inProgressTodo = todos.find((todo) => todo.status === "in_progress");
  if (inProgressTodo) {
    return inProgressTodo.content;
  }

  const pendingTodo = todos.find((todo) => todo.status === "pending");
  return pendingTodo?.content ?? null;
}

function isInFlightTodoCall(toolCallState: ToolCallState): boolean {
  return (
    toolCallState.status === "generated" ||
    toolCallState.status === "generating" ||
    toolCallState.status === "calling"
  );
}

export function findLatestTodoToolCallStateInCurrentTurn(
  history: HistoryEntryWithToolCalls[],
): ToolCallState | undefined {
  let latestTodoToolCallState: ToolCallState | undefined;

  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.message.role === "user") {
      break;
    }

    const toolCallStates = item.toolCallStates;
    if (!toolCallStates || toolCallStates.length === 0) {
      continue;
    }

    const todoToolCallStates = [...toolCallStates]
      .reverse()
      .filter(
        (toolCallState) =>
          toolCallState.toolCall.function?.name === BuiltInToolNames.TodoWrite,
      );

    for (const todoToolCallState of todoToolCallStates) {
      if (!latestTodoToolCallState) {
        latestTodoToolCallState = todoToolCallState;
      }

      const todos = getTodosFromTodoToolCall(todoToolCallState);
      if (todos.length > 0) {
        return todoToolCallState;
      }

      // If a call completed with an empty todo list, respect that final state.
      if (!isInFlightTodoCall(todoToolCallState)) {
        return todoToolCallState;
      }
    }
  }

  return latestTodoToolCallState;
}

function getProgressLabel(todos: TodoEntry[]): string {
  if (todos.length === 0) {
    return "0/0";
  }

  const completedCount = todos.filter(
    (todo) => todo.status === "completed" || todo.status === "cancelled",
  ).length;
  const hasInProgress = todos.some((todo) => todo.status === "in_progress");
  const currentCount = Math.min(
    todos.length,
    hasInProgress ? completedCount + 1 : completedCount,
  );

  return `${currentCount}/${todos.length}`;
}

function TodoStatusDot({ status }: { status: TodoStatus }) {
  if (status === "completed") {
    return (
      <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-solid bg-[color:var(--vscode-editor-background)] text-[9px] font-bold text-[color:var(--vscode-testing-iconPassed)]">
        ✓
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-solid border-[color:var(--vscode-testing-iconFailed)] text-[9px] font-bold text-[color:var(--vscode-testing-iconFailed)]">
        ×
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <span className="relative flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-solid border-[color:var(--vscode-textLink-foreground)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--vscode-textLink-foreground)]" />
      </span>
    );
  }

  return (
    <span className="relative flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border border-solid border-[color:var(--vscode-textLink-foreground)]">
      <span className="h-1.5 w-1.5 rounded-full" />
    </span>
  );
}

export function TodoListMenu({
  toolCallState,
  roundedTop = true,
}: {
  toolCallState: ToolCallState;
  roundedTop?: boolean;
}) {
  const todos = useMemo(
    () => getTodosFromTodoToolCall(toolCallState),
    [toolCallState],
  );

  const [open, setOpen] = useState(true);
  const progressLabel = getProgressLabel(todos);
  const bodyId = `todo-list-menu-body-${toolCallState.toolCallId}`;

  return (
    <div className="mt-1" data-testid="todo-list-menu">
      <div
        className={`border-command-border bg-vsc-editor-background overflow-hidden border border-b-0 border-solid ${
          roundedTop ? "rounded-t-default" : ""
        }`}
      >
        <button
          type="button"
          data-testid="todo-list-menu-header"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((prev) => !prev)}
          className="text-description hover:bg-vsc-input-background/40 flex w-full items-center justify-between gap-2 border-none bg-transparent px-2 py-2 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {open ? (
              <ChevronDownIcon className="h-4 w-4 flex-shrink-0 opacity-70" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0 opacity-70" />
            )}
            <span className="truncate text-sm font-medium">
              Todos ({progressLabel})
            </span>
          </span>
          <QueueListIcon className="ml-auto h-4 w-4 flex-shrink-0 opacity-60" />
        </button>

        <div
          id={bodyId}
          data-testid="todo-list-menu-body"
          className={`transition-all duration-200 ease-in-out ${
            open
              ? "max-h-[40vh] opacity-100"
              : "max-h-0 overflow-hidden opacity-0"
          }`}
        >
          <div className="thin-scrollbar max-h-[40vh] overflow-y-auto px-4 pb-3 pt-0.5">
            {todos.length === 0 ? (
              <p className="text-description-muted m-0 py-1 text-xs italic">
                No todos
              </p>
            ) : (
              <ol
                className="m-0 list-none space-y-1.5 p-0"
                data-testid="todo-list-menu-items"
              >
                {todos.map((todo) => {
                  const isTerminal =
                    todo.status === "completed" || todo.status === "cancelled";

                  return (
                    <li
                      key={todo.id}
                      className={`text-description flex min-w-0 items-start gap-2 text-sm ${
                        todo.status === "in_progress"
                          ? "text-[color:var(--vscode-textLink-foreground)]"
                          : ""
                      }`}
                      data-testid={`todo-list-menu-item-${todo.id}`}
                    >
                      <span className="mt-[2px]">
                        <TodoStatusDot status={todo.status} />
                      </span>
                      <span
                        className={`min-w-0 ${isTerminal ? "text-description-muted" : ""}`}
                      >
                        {todo.content}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
