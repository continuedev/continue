import type {
  ChatMessage,
  TaskItem,
  TaskPlan,
  TaskStatus,
  UserChatMessage,
} from "../index.js";

/**
 * The agent's task list: validation, the block sent at the tail of each
 * request, and the progress line. Shared by the IDE (gui) and the CLI.
 * Design: plans/task-planning.md, Track F.
 */

export const TASK_STATUSES: readonly TaskStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
];

/** Caps so a runaway model cannot fill the request with its list. */
export const TASK_PLAN_LIMITS = {
  maxItems: 50,
  maxTextLength: 200,
  maxNoteLength: 200,
  maxActiveFormLength: 120,
  maxIdLength: 40,
  /** Completed items shown in the request block; older ones are a count */
  shownCompleted: 3,
} as const;

export const TASK_STATUS_MARKERS: Record<TaskStatus, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
  cancelled: "[-]",
  blocked: "[!]",
};

/**
 * First line of the request block. Bedrock's message conversion
 * (core/llm/llms/Bedrock.ts and packages/openai-adapters/src/apis/Bedrock.ts,
 * which keeps its own copy of this string) recognises a trailing text block
 * that starts with it and puts the conversation cache point before it, so a
 * change to the list never changes the cached prefix.
 */
export const TASK_LIST_BLOCK_OPEN = "<task_list>";
export const TASK_LIST_BLOCK_CLOSE = "</task_list>";

/** The task list tool's description, shared by the IDE (task_list) and the CLI (TaskList). */
export const TASK_LIST_TOOL_DESCRIPTION = `Write your task list for the current work: the complete list each time, in order. Use it for work with three or more distinct steps, or when the user gives you several things to do; skip it for a single quick change.

Rules:
- Exactly one item is in_progress while you work. Mark an item in_progress before you start it and completed as soon as it is done, not in batches.
- Use blocked (with a note saying why) or cancelled instead of deleting an item that did not get done.
- Keep each item short and specific. Optionally give activeForm, a present-tense label shown while the item runs ("Running migrations").
- Repeat the id of items you keep. New items need no id. Completed items you leave out are kept; open items you leave out are removed. Set reset to true to start a new list for unrelated work.

The list is stored outside the conversation and sent back to you at the end of every request, so it survives compaction. The user can see and edit it; when they do, their version is what you get back.`;

/** One item as a tool call or an edit supplies it: `id` optional for new items. */
export interface TaskItemInput {
  id?: unknown;
  text?: unknown;
  status?: unknown;
  note?: unknown;
  activeForm?: unknown;
}

export type TaskPlanResult =
  { ok: true; plan: TaskPlan } | { ok: false; error: string };

function isStatus(value: unknown): value is TaskStatus {
  return (
    typeof value === "string" &&
    (TASK_STATUSES as readonly string[]).includes(value)
  );
}

function optionalText(
  value: unknown,
  field: string,
  max: number,
  position: number,
): { value?: string; error?: string } {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string") {
    return { error: `Item ${position}: ${field} must be a string` };
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return {
      error: `Item ${position}: ${field} is longer than ${max} characters`,
    };
  }
  return trimmed ? { value: trimmed } : {};
}

/**
 * Builds a plan from a whole list, as the `TaskList` tool receives it.
 *
 * - `id` is optional on new items. An item without one takes the id of a
 *   previous item with the same text, otherwise the next free number, so ids
 *   stay stable when a model repeats the list without them.
 * - Completed items of the previous plan that the new list leaves out are kept
 *   (the request block folds old completed items into a count, so the model
 *   cannot repeat them). Leaving out an open item removes it. `reset` starts a
 *   fresh list instead.
 * - At most one item in progress, at most `maxItems` items (kept completed
 *   items are dropped oldest first to make room), no empty text.
 */
export function buildTaskPlan(
  input: unknown,
  options: {
    previous?: TaskPlan;
    reset?: boolean;
    updatedBy?: "model" | "user";
    now?: Date;
  } = {},
): TaskPlanResult {
  if (!Array.isArray(input)) {
    return { ok: false, error: "items must be an array" };
  }
  if (input.length > TASK_PLAN_LIMITS.maxItems) {
    return {
      ok: false,
      error: `Too many items (${input.length}); the limit is ${TASK_PLAN_LIMITS.maxItems}. Merge small steps.`,
    };
  }

  const previousItems = options.reset ? [] : (options.previous?.items ?? []);
  const previousByText = new Map<string, string>();
  for (const item of previousItems) {
    if (!previousByText.has(item.text)) {
      previousByText.set(item.text, item.id);
    }
  }

  const items: TaskItem[] = [];
  const seenIds = new Set<string>();
  let inProgress = 0;

  for (let i = 0; i < input.length; i++) {
    const position = i + 1;
    const raw = input[i] as TaskItemInput;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Item ${position} must be an object` };
    }
    if (typeof raw.text !== "string" || !raw.text.trim()) {
      return { ok: false, error: `Item ${position} has no text` };
    }
    const text = raw.text.trim().replace(/\s*\n\s*/g, " ");
    if (text.length > TASK_PLAN_LIMITS.maxTextLength) {
      return {
        ok: false,
        error: `Item ${position} is longer than ${TASK_PLAN_LIMITS.maxTextLength} characters. Keep items short.`,
      };
    }
    const status = raw.status === undefined ? "pending" : raw.status;
    if (!isStatus(status)) {
      return {
        ok: false,
        error: `Item ${position} has an unknown status ${JSON.stringify(raw.status)}; use one of ${TASK_STATUSES.join(", ")}`,
      };
    }
    if (status === "in_progress") {
      inProgress++;
    }

    let id: string | undefined;
    if (raw.id !== undefined && raw.id !== null && raw.id !== "") {
      if (typeof raw.id !== "string" && typeof raw.id !== "number") {
        return { ok: false, error: `Item ${position}: id must be a string` };
      }
      id = String(raw.id).trim();
      if (!id || id.length > TASK_PLAN_LIMITS.maxIdLength) {
        return { ok: false, error: `Item ${position} has an invalid id` };
      }
      if (seenIds.has(id)) {
        return { ok: false, error: `Duplicate id ${id}` };
      }
    } else {
      const reused = previousByText.get(text);
      if (reused !== undefined && !seenIds.has(reused)) {
        id = reused;
      }
    }

    const note = optionalText(
      raw.note,
      "note",
      TASK_PLAN_LIMITS.maxNoteLength,
      position,
    );
    if (note.error) {
      return { ok: false, error: note.error };
    }
    const activeForm = optionalText(
      raw.activeForm,
      "activeForm",
      TASK_PLAN_LIMITS.maxActiveFormLength,
      position,
    );
    if (activeForm.error) {
      return { ok: false, error: activeForm.error };
    }

    if (id !== undefined) {
      seenIds.add(id);
    }
    items.push({
      id: id ?? "",
      text,
      status,
      ...(note.value && { note: note.value }),
      ...(activeForm.value && { activeForm: activeForm.value }),
    });
  }

  if (inProgress > 1) {
    return {
      ok: false,
      error: `${inProgress} items are in_progress; at most one may be. Mark the others pending or completed.`,
    };
  }

  // Completed items the list left out are kept, before the new items.
  const kept = previousItems.filter(
    (item) =>
      item.status === "completed" &&
      !seenIds.has(item.id) &&
      !items.some((i) => i.id === "" && i.text === item.text),
  );
  const room = TASK_PLAN_LIMITS.maxItems - items.length;
  const keptToUse = kept.slice(Math.max(0, kept.length - room));
  for (const item of keptToUse) {
    seenIds.add(item.id);
  }

  // Ids for new items: the next free number.
  let next = 1;
  for (const id of seenIds) {
    if (/^\d+$/.test(id)) {
      next = Math.max(next, Number(id) + 1);
    }
  }
  for (const item of items) {
    if (item.id === "") {
      while (seenIds.has(String(next))) {
        next++;
      }
      item.id = String(next++);
      seenIds.add(item.id);
    }
  }

  return {
    ok: true,
    plan: {
      items: [...keptToUse, ...items],
      updatedAt: (options.now ?? new Date()).toISOString(),
      updatedBy: options.updatedBy ?? "model",
    },
  };
}

/** Checks a stored plan (for example one read from a session file). */
export function isTaskPlan(value: unknown): value is TaskPlan {
  if (!value || typeof value !== "object") {
    return false;
  }
  const plan = value as TaskPlan;
  return (
    Array.isArray(plan.items) &&
    plan.items.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        isStatus(item.status),
    )
  );
}

export interface TaskPlanProgress {
  done: number;
  total: number;
  /** The in-progress item, or else the first open one */
  current?: TaskItem;
}

/** Counts cancelled items as done: they need no more work. */
export function taskPlanProgress(plan: TaskPlan | undefined): TaskPlanProgress {
  const items = plan?.items ?? [];
  const done = items.filter(
    (i) => i.status === "completed" || i.status === "cancelled",
  ).length;
  const current =
    items.find((i) => i.status === "in_progress") ??
    items.find((i) => i.status === "pending" || i.status === "blocked");
  return { done, total: items.length, current };
}

/** "3/8 Running migrations": the strip above the input in both clients. */
export function formatTaskProgress(plan: TaskPlan | undefined): string {
  const { done, total, current } = taskPlanProgress(plan);
  if (total === 0) {
    return "";
  }
  if (!current) {
    return `${done}/${total} done`;
  }
  const label =
    current.status === "in_progress"
      ? (current.activeForm ?? current.text)
      : current.text;
  return `${done}/${total} ${label}`;
}

function itemLine(item: TaskItem): string {
  const line = `${TASK_STATUS_MARKERS[item.status]} ${item.id}. ${item.text}`;
  if (item.note && (item.status === "blocked" || item.status === "cancelled")) {
    return `${line} (${item.note})`;
  }
  return line;
}

/**
 * The block sent with each request: one line per item, completed items
 * beyond the last few folded into a count. Deterministic for a given plan.
 */
export function formatTaskPlanBlock(plan: TaskPlan | undefined): string {
  const items = plan?.items ?? [];
  if (items.length === 0) {
    return "";
  }

  const completed = items.filter((i) => i.status === "completed");
  const hidden = new Set(
    completed
      .slice(0, Math.max(0, completed.length - TASK_PLAN_LIMITS.shownCompleted))
      .map((i) => i.id),
  );

  const lines = [
    TASK_LIST_BLOCK_OPEN,
    "Your current task list, kept outside the conversation. Update it with the task list tool by sending the whole list; completed items you leave out are kept. Markers: [ ] pending, [>] in progress, [x] completed, [-] cancelled, [!] blocked.",
  ];
  if (plan?.updatedBy === "user") {
    lines.push(
      "The user edited this list since your last update. Keep their changes.",
    );
  }
  if (hidden.size > 0) {
    lines.push(`[x] ${hidden.size} earlier items completed (not shown)`);
  }
  for (const item of items) {
    if (!hidden.has(item.id)) {
      lines.push(itemLine(item));
    }
  }
  lines.push(TASK_LIST_BLOCK_CLOSE);
  return lines.join("\n");
}

/**
 * The block as a message to put after the history, or undefined when there is
 * no list. It goes at the tail so that a change to the list only changes the
 * tail of the request: the tools, system message and history before it stay
 * byte-identical and keep their prompt-cache entries.
 */
export function taskPlanTailMessage(
  plan: TaskPlan | undefined,
): UserChatMessage | undefined {
  const block = formatTaskPlanBlock(plan);
  return block ? { role: "user", content: block } : undefined;
}

/** Returns `messages` with the task list block appended (a new array). */
export function appendTaskPlanBlock(
  messages: ChatMessage[],
  plan: TaskPlan | undefined,
): ChatMessage[] {
  const tail = taskPlanTailMessage(plan);
  return tail ? [...messages, tail] : messages;
}

/** True for a message text that is the task list block. */
export function isTaskPlanBlockText(text: string | undefined): boolean {
  return !!text && text.startsWith(TASK_LIST_BLOCK_OPEN);
}

/** Short confirmation the tool returns instead of echoing the list. */
export function taskPlanConfirmation(plan: TaskPlan): string {
  const { done, total, current } = taskPlanProgress(plan);
  const parts = [`Task list saved: ${done}/${total} done.`];
  if (current?.status === "in_progress") {
    parts.push(`In progress: ${current.id}. ${current.text}.`);
  } else if (current) {
    parts.push(`Next: ${current.id}. ${current.text}.`);
  }
  parts.push("It is sent with every request, so you do not need to repeat it.");
  return parts.join(" ");
}

/**
 * Parses a markdown checkbox list (the CLI `Checklist` tool's input) into
 * items for `buildTaskPlan`. `- [ ]` pending, `- [x]` completed, and the
 * request block's own markers `[>]`, `[-]`, `[!]`. Other lines are ignored.
 */
export function parseMarkdownChecklist(markdown: string): TaskItemInput[] {
  const statusByMark: Record<string, TaskStatus> = {
    " ": "pending",
    x: "completed",
    X: "completed",
    ">": "in_progress",
    "-": "cancelled",
    "!": "blocked",
  };
  const items: TaskItemInput[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*+]|\d+\.)\s*\[([ xX>!-])\]\s*(.*)$/);
    if (match && match[2].trim()) {
      items.push({ text: match[2].trim(), status: statusByMark[match[1]] });
    }
  }
  return items;
}

/** The plan as a markdown checkbox list, for displays that render one. */
export function taskPlanToMarkdown(plan: TaskPlan | undefined): string {
  return (plan?.items ?? [])
    .map((item) => `- ${TASK_STATUS_MARKERS[item.status]} ${item.text}`)
    .join("\n");
}
