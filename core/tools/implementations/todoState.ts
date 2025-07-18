// In-memory state management for markdown todo lists with full history. Todo
// format: [ ] planned, [x] done, [*] in progress, [~] cancelled. Each history
// item stores the complete markdown content at that point in time.

interface TodoState {
  history: string[];
  currentIndex: number;
}

// In-memory state storage
let todoState: TodoState = {
  history: [],
  currentIndex: -1,
};

export function getTodoMarkdown(): string {
  if (todoState.currentIndex < 0 || todoState.history.length === 0) {
    return "";
  }
  return todoState.history[todoState.currentIndex];
}

export function setTodoMarkdown(markdown: string): void {
  // Add new state to history
  todoState.history.push(markdown);
  todoState.currentIndex = todoState.history.length - 1;
}

export function getTodoHistory(): string[] {
  return [...todoState.history];
}

export function clearTodoState(): void {
  todoState = {
    history: [],
    currentIndex: -1,
  };
}

export interface TodoCounts {
  planned: number;
  done: number;
  inProgress: number;
  cancelled: number;
  total: number;
}

export function countTodos(markdown: string): TodoCounts {
  const lines = markdown.split("\n");
  let planned = 0;
  let done = 0;
  let inProgress = 0;
  let cancelled = 0;

  for (const line of lines) {
    if (line.includes("- [ ]")) planned++;
    else if (line.includes("- [x]")) done++;
    else if (line.includes("- [*]")) inProgress++;
    else if (line.includes("- [~]")) cancelled++;
  }

  return {
    planned,
    done,
    inProgress,
    cancelled,
    total: planned + done + inProgress + cancelled,
  };
}

export function getTodoSummary(counts: TodoCounts): string {
  return counts.total > 0
    ? `${counts.planned} planned, ${counts.inProgress} in progress, ${counts.done} done`
    : "empty";
}
