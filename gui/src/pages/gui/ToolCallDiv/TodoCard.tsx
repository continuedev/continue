// TodoCard component for displaying markdown todo lists. Parses markdown format
// with legend: [ ] planned, [x] done, [*] in progress, [~] cancelled. Shows
// changes between versions and supports expanding/collapsing view.
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState, useMemo } from "react";
import { FileInfo } from "../../../components/StyledMarkdownPreview/StepContainerPreToolbar/FileInfo";

interface ParsedTodo {
  content: string;
  status: "planned" | "done" | "in_progress" | "cancelled";
  line: string;
  indentLevel: number;
}

interface TodoCardProps {
  markdown: string;
  previousMarkdown?: string;
  historyIndex: number;
  toolCallId?: string;
}

export function TodoCard({
  markdown,
  previousMarkdown,
  historyIndex,
  toolCallId,
}: TodoCardProps) {
  const [viewMode, setViewMode] = useState<"changes" | "all">("changes");
  const [changedLines, setChangedLines] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Parse markdown to extract todos
  const parseTodos = (md: string): ParsedTodo[] => {
    if (!md) return [];

    const lines = md.split("\n");
    const todos: ParsedTodo[] = [];
    let inComment = false;

    for (const line of lines) {
      // Track HTML comment blocks
      if (line.includes("<!--")) {
        inComment = true;
      }
      if (line.includes("-->")) {
        inComment = false;
        continue;
      }

      // Skip lines inside comments
      if (inComment) {
        continue;
      }

      // Calculate indentation level by counting leading spaces
      const leadingSpaces = line.match(/^(\s*)/)?.[0].length || 0;
      const indentLevel = Math.floor(leadingSpaces / 2); // 2 spaces per indent level

      if (line.includes("- [ ]")) {
        todos.push({
          content: line.replace(/^\s*- \[ \]\s*/, "").trim(),
          status: "planned",
          line: line,
          indentLevel: indentLevel,
        });
      } else if (line.includes("- [x]")) {
        todos.push({
          content: line.replace(/^\s*- \[x\]\s*/, "").trim(),
          status: "done",
          line: line,
          indentLevel: indentLevel,
        });
      } else if (line.includes("- [*]")) {
        todos.push({
          content: line.replace(/^\s*- \[\*\]\s*/, "").trim(),
          status: "in_progress",
          line: line,
          indentLevel: indentLevel,
        });
      } else if (line.includes("- [~]")) {
        todos.push({
          content: line.replace(/^\s*- \[~\]\s*/, "").trim(),
          status: "cancelled",
          line: line,
          indentLevel: indentLevel,
        });
      }
    }

    return todos;
  };

  const todos = useMemo(() => parseTodos(markdown), [markdown]);

  useEffect(() => {
    if (markdown) {
      setIsInitialized(true);

      const changed = new Set<string>();
      if (previousMarkdown) {
        const prevLines = new Set(previousMarkdown.split("\n"));
        const currLines = markdown.split("\n");

        // Find changed or new lines
        currLines.forEach((line) => {
          if (line.includes("- [") && !prevLines.has(line)) {
            changed.add(line);
          }
        });
      } else {
        // First time - all todo lines are "changed"
        todos.forEach((todo) => changed.add(todo.line));
      }

      setChangedLines(changed);
    }
  }, [markdown, previousMarkdown, todos]);

  const getStatusIcon = (status: ParsedTodo["status"]) => {
    switch (status) {
      case "done":
        return (
          <CheckCircleIcon className="h-4 w-4 text-green-500" title="Done" />
        );
      case "in_progress":
        return (
          <ClockIcon className="h-4 w-4 text-blue-500" title="In Progress" />
        );
      case "cancelled":
        return (
          <XCircleIcon className="h-4 w-4 text-red-500" title="Cancelled" />
        );
      case "planned":
        return (
          <PlusCircleIcon className="h-4 w-4 text-gray-400" title="Planned" />
        );
      default:
        return (
          <PlusCircleIcon className="h-4 w-4 text-gray-400" title="Planned" />
        );
    }
  };

  const plannedCount = todos.filter((t) => t.status === "planned").length;
  const inProgressCount = todos.filter(
    (t) => t.status === "in_progress",
  ).length;
  const doneCount = todos.filter((t) => t.status === "done").length;

  // Don't render until we have real data
  if (!isInitialized || !markdown) {
    return null;
  }

  // Determine which todos to show
  const todosToShow =
    viewMode === "all"
      ? todos
      : todos.filter((todo) => changedLines.has(todo.line));

  const hasHiddenTodos =
    viewMode === "changes" && todosToShow.length < todos.length;

  return (
    <div className="outline-command-border -outline-offset-0.5 rounded-default bg-editor mt-2 flex min-w-0 flex-col outline outline-1">
      <div className="bg-editor border-command-border sticky -top-2 z-10 m-0 flex items-center justify-between gap-3 rounded-lg border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <ChevronDownIcon
            data-testid="toggle-todo-card"
            onClick={() => {
              setViewMode(viewMode === "changes" ? "all" : "changes");
            }}
            className={`text-lightgray h-3.5 w-3.5 flex-shrink-0 cursor-pointer hover:brightness-125 ${
              viewMode === "all" ? "rotate-0" : "-rotate-90"
            }`}
          />
          <FileInfo filepath="TODO.md" />
          <span className="text-description text-sm">
            ({plannedCount} planned, {inProgressCount} in progress, {doneCount}{" "}
            done)
          </span>
        </div>
      </div>

      <div className="space-y-1 p-3">
        {todosToShow.map((todo, index) => (
          <div
            key={`${todo.line}-${index}`}
            className={`flex items-start gap-2 rounded p-1 ${
              changedLines.has(todo.line)
                ? "bg-warning/10 border-warning/30 border"
                : "bg-secondary/10"
            }`}
            style={{ marginLeft: `${todo.indentLevel * 20}px` }}
          >
            {getStatusIcon(todo.status)}
            <div className="flex-1">
              <span
                className={
                  todo.status === "done"
                    ? "text-description"
                    : todo.status === "cancelled"
                      ? "text-description-muted"
                      : ""
                }
              >
                {todo.content}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
