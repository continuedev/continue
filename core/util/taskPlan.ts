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
  /** A to-do's check command (TaskItem.check) */
  maxCheckLength: 500,
  /** A to-do's model name (TaskItem.model) */
  maxModelLength: 100,
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
export const TASK_LIST_TOOL_DESCRIPTION = `Your task list: while planning, the steps of the work; while building, the list the plan gave you, to keep current. Send the complete list each time, in order.

Rules:
- Exactly one item is in_progress while you work. Mark an item in_progress before you start it and completed as soon as it is done, not in batches.
- Use blocked (with a note saying why) or cancelled instead of deleting an item that did not get done.
- Keep each item short and specific. Optionally give activeForm, a present-tense label shown while the item runs ("Running migrations").
- Repeat the id of items you keep. New items need no id. Completed items you leave out are kept. While planning, open items you leave out are removed and reset starts a new list; while building, open items you leave out are kept, so use cancelled to drop one.

The list is stored outside the conversation and sent back to you at the end of every request, so it survives compaction. The user can see and edit it; when they do, their version is what you get back.`;

/** One item as a tool call or an edit supplies it: `id` optional for new items. */
export interface TaskItemInput {
  id?: unknown;
  text?: unknown;
  status?: unknown;
  note?: unknown;
  activeForm?: unknown;
  /**
   * The items this one comes after, as 1-based positions in the same list
   * (numbers, or numeric strings); stored as ids (TaskItem.after)
   */
  after?: unknown;
  /** A command that confirms the item is done (TaskItem.check) */
  check?: unknown;
  /** The name of the chat model the item's Loop run goes to (TaskItem.model) */
  model?: unknown;
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
    /**
     * Building from a plan: the list may be sent in part, so items left out
     * stay where they are and an item named by id may leave out its text. A
     * model that sent only the two items it was changing removed the other
     * six to-dos of a plan.
     */
    keepOpen?: boolean;
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
  /** Each item's `after` positions, resolved to ids once every id is known */
  const afterPositions: number[][] = [];

  for (let i = 0; i < input.length; i++) {
    const position = i + 1;
    const raw = input[i] as TaskItemInput;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Item ${position} must be an object` };
    }
    const rawText = itemText(raw, options.keepOpen ? previousItems : []);
    if (rawText === undefined) {
      return { ok: false, error: `Item ${position} has no text` };
    }
    const text = rawText.replace(/\s*\n\s*/g, " ");
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

    const extras = itemExtras(raw, position, input.length);
    if ("error" in extras) {
      return { ok: false, error: extras.error };
    }
    afterPositions.push(extras.after);

    if (id !== undefined) {
      seenIds.add(id);
    }
    items.push({
      id: id ?? "",
      text,
      status,
      ...(note.value && { note: note.value }),
      ...(activeForm.value && { activeForm: activeForm.value }),
      ...extras.fields,
    });
  }

  const circle = afterCircleError(afterPositions);
  if (circle) {
    return { ok: false, error: circle };
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

  // Ids for new items: the next free number, above the previous list's too.
  // A Loop keeps each item's state under its id, so a new to-do that took the
  // id of a dropped one would inherit its attempts and its failed check.
  let next = nextFreeNumber([
    ...seenIds,
    ...previousItems.map((item) => item.id),
  ]);
  for (const item of items) {
    if (item.id === "") {
      while (seenIds.has(String(next))) {
        next++;
      }
      item.id = String(next++);
      seenIds.add(item.id);
    }
  }

  applyAfter(items, afterPositions);

  const finalItems = withOmittedItems(
    previousItems,
    keptToUse,
    items,
    options.keepOpen,
  );
  if (finalItems.length > TASK_PLAN_LIMITS.maxItems) {
    return {
      ok: false,
      error: `Too many items (${finalItems.length}); the limit is ${TASK_PLAN_LIMITS.maxItems}.`,
    };
  }

  return {
    ok: true,
    plan: {
      items: finalItems,
      updatedAt: (options.now ?? new Date()).toISOString(),
      updatedBy: options.updatedBy ?? "model",
    },
  };
}

/** An item's text, or that of the previous item its id names; undefined if none. */
function itemText(
  raw: TaskItemInput,
  previous: TaskItem[],
): string | undefined {
  if (typeof raw.text === "string" && raw.text.trim()) return raw.text.trim();
  return previous.find((item) => item.id === String(raw.id))?.text;
}

/** One above the highest numeric id. */
function nextFreeNumber(ids: string[]): number {
  let next = 1;
  for (const id of ids) {
    if (/^\d+$/.test(id)) {
      next = Math.max(next, Number(id) + 1);
    }
  }
  return next;
}

/**
 * The finished list. A whole list stands as sent, in its order. With keepOpen,
 * a list that left out an open item was a partial update.
 */
function withOmittedItems(
  previous: TaskItem[],
  kept: TaskItem[],
  items: TaskItem[],
  keepOpen: boolean | undefined,
): TaskItem[] {
  const sent = new Set(items.map((item) => item.id));
  const partial = previous.some(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled" &&
      !sent.has(item.id),
  );
  return keepOpen && partial
    ? mergeIntoPrevious(previous, items)
    : [...kept, ...items];
}

/**
 * A partial update laid over the previous list: each item keeps its place and
 * what the update did not say, the rest stay, and new items go last. An item
 * left out stops being in progress when the update names another that is.
 */
function mergeIntoPrevious(
  previous: TaskItem[],
  items: TaskItem[],
): TaskItem[] {
  const updates = new Map(items.map((item) => [item.id, item]));
  const known = new Set(previous.map((item) => item.id));
  const moved = items.some((item) => item.status === "in_progress");
  const merged = previous.map((item): TaskItem => {
    const update = updates.get(item.id);
    if (update) return { ...item, ...update };
    return moved && item.status === "in_progress"
      ? { ...item, status: "pending" }
      : item;
  });
  return [...merged, ...items.filter((item) => !known.has(item.id))];
}

/** An item's check command, model and `after` positions, or why they are invalid. */
function itemExtras(
  raw: TaskItemInput,
  position: number,
  count: number,
):
  | { fields: { check?: string; model?: string }; after: number[] }
  | { error: string } {
  const check = optionalText(
    raw.check,
    "check",
    TASK_PLAN_LIMITS.maxCheckLength,
    position,
  );
  if (check.error) return { error: check.error };
  const model = optionalText(
    raw.model,
    "model",
    TASK_PLAN_LIMITS.maxModelLength,
    position,
  );
  if (model.error) return { error: model.error };
  const after = afterList(raw.after, position, count);
  if (typeof after === "string") return { error: after };
  return {
    fields: {
      ...(check.value && { check: check.value.replace(/\s*\n\s*/g, " ") }),
      ...(model.value && { model: model.value.replace(/\s+/g, " ") }),
    },
    after,
  };
}

/**
 * An item's `after` positions: 1-based, in the list, not the item itself.
 * Returns the error text when they are not.
 */
function afterList(
  value: unknown,
  position: number,
  count: number,
): number[] | string {
  if (value === undefined || value === null || value === "") return [];
  const raw =
    typeof value === "string"
      ? value.split(/[\s,]+/).filter(Boolean)
      : Array.isArray(value)
        ? value
        : [value];
  const positions: number[] = [];
  for (const entry of raw) {
    const n = typeof entry === "number" ? entry : Number(String(entry).trim());
    if (!Number.isInteger(n) || n < 1 || n > count) {
      return `Item ${position}: after: must list item numbers from 1 to ${count}`;
    }
    if (n === position) {
      return `Item ${position} cannot come after itself`;
    }
    if (!positions.includes(n)) positions.push(n);
  }
  return positions;
}

/** The error for a circle of `after` references, if there is one. */
function afterCircleError(after: number[][]): string | undefined {
  const cycle = afterCycle(after);
  return cycle
    ? `Items ${cycle.join(", ")} come after each other in a circle; remove one of the after: lines.`
    : undefined;
}

/** `after` positions become the ids the items now have. */
function applyAfter(items: TaskItem[], afterPositions: number[][]): void {
  items.forEach((item, i) => {
    const after = afterPositions[i].map((p) => items[p - 1].id);
    if (after.length) item.after = after;
  });
}

/** The positions in a circle of `after` references, if there is one. */
function afterCycle(after: number[][]): number[] | undefined {
  const state = new Map<number, "visiting" | "done">();
  const path: number[] = [];
  const visit = (p: number): number[] | undefined => {
    if (state.get(p) === "done") return undefined;
    if (state.get(p) === "visiting") return path.slice(path.indexOf(p));
    state.set(p, "visiting");
    path.push(p);
    for (const q of after[p - 1] ?? []) {
      const found = visit(q);
      if (found) return found;
    }
    path.pop();
    state.set(p, "done");
    return undefined;
  };
  for (let p = 1; p <= after.length; p++) {
    const found = visit(p);
    if (found) return found;
  }
  return undefined;
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
    // Leads with what the block is, not with "update it": read as an
    // instruction, GPT-OSS and Nova Pro resent the list unchanged 24, 67 and
    // 107 times in a turn (research-bedrock-families.md item 3).
    "This is your saved task list; it is shown with every request. Call the task list tool only to change an item's status or wording, never to resend it unchanged. When you do, send the whole list; completed items you leave out are kept. Markers: [ ] pending, [>] in progress, [x] completed, [-] cancelled, [!] blocked.",
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
 * A trailing `<!-- id: 3 -->` comment (as plan files write it) gives the
 * item's id, so ids survive a round trip through a file the person edits.
 * Indented `after:`, `check:` and `model:` lines under an item belong to it.
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
    // `  after: 1, 2`, `  check: <command>` and `  model: <name>` under a
    // to-do belong to it
    const attribute = line.match(ITEM_ATTRIBUTE);
    if (attribute && items.length > 0) {
      const last = items[items.length - 1];
      const key = attribute[1].toLowerCase() as "after" | "check" | "model";
      last[key] = attribute[2].trim();
      continue;
    }
    const match = line.match(/^\s*(?:[-*+]|\d+\.)\s*\[([ xX>!-])\]\s*(.*)$/);
    if (!match) {
      continue;
    }
    let text = match[2].trim();
    let id: string | undefined;
    const idComment = text.match(TASK_ID_COMMENT);
    if (idComment) {
      id = idComment[1];
      text = text.slice(0, idComment.index).trim();
    }
    if (text) {
      items.push({
        ...(id !== undefined && { id }),
        text,
        status: statusByMark[match[1]],
      });
    }
  }
  return items;
}

/** An indented `after: 1, 2`, `check: <command>` or `model: <name>` line under a to-do. */
const ITEM_ATTRIBUTE = /^(?:\t|\s{2,})(after|check|model)\s*:\s*(.*)$/i;

/** The lines a plan file writes under a to-do for its `after`, `check` and `model`. */
export function taskItemAttributeLines(
  item: TaskItem,
  items: TaskItem[],
): string[] {
  const lines: string[] = [];
  const positions = (item.after ?? [])
    .map((id) => items.findIndex((i) => i.id === id) + 1)
    .filter((p) => p > 0);
  if (positions.length) lines.push(`  after: ${positions.join(", ")}`);
  if (item.check) lines.push(`  check: ${item.check}`);
  if (item.model) lines.push(`  model: ${item.model}`);
  return lines;
}

/** `<!-- id: 3 -->` at the end of a checklist line. */
const TASK_ID_COMMENT = /\s*<!--\s*id:\s*([A-Za-z0-9_.-]{1,40})\s*-->\s*$/;

/** The id comment a plan file writes after an item. */
export function taskIdComment(id: string): string {
  return `<!-- id: ${id} -->`;
}

/** The plan as a markdown checkbox list, for displays that render one. */
export function taskPlanToMarkdown(plan: TaskPlan | undefined): string {
  return (plan?.items ?? [])
    .map((item) => `- ${TASK_STATUS_MARKERS[item.status]} ${item.text}`)
    .join("\n");
}
