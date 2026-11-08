import type { TaskItem, TaskPlan } from "../index.js";
import {
  buildTaskPlan,
  parseMarkdownChecklist,
  TASK_PLAN_LIMITS,
  TASK_STATUS_MARKERS,
  taskIdComment,
  taskItemAttributeLines,
  type TaskItemInput,
  type TaskPlanResult,
} from "./taskPlan.js";

/**
 * Plan files: what Plan mode ends with. A plan is a markdown file in the
 * workspace, `.continuous/plans/<slug>.md`, with a title, a short body and a
 * to-do checklist whose items are the session's task list (one to-do, one
 * TaskItem). The person can edit the file; Build reads it back.
 * Design: plans/task-planning.md (P4) and plans/agent-ux-parity.md (phase P).
 *
 * ```markdown
 * # Add retry to the uploader
 *
 * Why and how, in a few paragraphs.
 *
 * ## To-dos
 *
 * - [ ] Add a retry helper <!-- id: 1 -->
 * - [ ] Use it in upload() <!-- id: 2 -->
 * ```
 */

/** Workspace-relative folder the plan files go in. */
export const PLANS_DIR = ".continuous/plans";

export const PLAN_TODOS_HEADING = "To-dos";

export const PLAN_LIMITS = {
  maxTitleLength: 120,
  /** The body is for people: a summary, the approach, the files involved. */
  maxBodyLength: 12_000,
  maxSlugLength: 60,
} as const;

/** The plan tool's name in the IDE (snake_case like the other core tools). */
export const PRESENT_PLAN_TOOL_NAME = "present_plan";
/** The plan tool's name in the CLI (PascalCase like the other CLI tools). */
export const PRESENT_PLAN_CLI_TOOL_NAME = "PresentPlan";

export interface PlanDocument {
  title: string;
  body: string;
  /** In file order; ids where the file has them. */
  items: TaskItemInput[];
}

/** A heading that starts the to-do list: To-dos, Todos, Tasks, Steps, Checklist. */
const TODOS_HEADING = /^(#{2,6})\s+(to-?dos?|tasks|steps|checklist)\s*:?\s*$/i;
const HEADING = /^(#{1,6})\s+\S/;
const CHECKBOX_LINE = /^\s*(?:[-*+]|\d+\.)\s*\[[ xX>!-]\]/;

/** "Add retry to the uploader" -> "add-retry-to-the-uploader". */
export function slugifyPlanTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PLAN_LIMITS.maxSlugLength)
    .replace(/-+$/g, "");
  return slug || "plan";
}

/**
 * The file name for a plan: `<slug>.md`, or `<slug>-2.md` and so on when
 * `isTaken` says a name is used by something other than this session's plan.
 */
export async function choosePlanFileName(
  title: string,
  isTaken: (fileName: string) => Promise<boolean> | boolean,
): Promise<string> {
  const slug = slugifyPlanTitle(title);
  for (let n = 1; n < 100; n++) {
    const name = n === 1 ? `${slug}.md` : `${slug}-${n}.md`;
    if (!(await isTaken(name))) {
      return name;
    }
  }
  return `${slug}-${Date.now()}.md`;
}

/** The plan as the file stores it. Deterministic for a given plan. */
export function serializePlanFile(plan: {
  title: string;
  body: string;
  items: TaskItem[];
}): string {
  const lines = [`# ${oneLine(plan.title) || "Plan"}`, ""];
  const body = plan.body.trim();
  if (body) {
    lines.push(body, "");
  }
  lines.push(`## ${PLAN_TODOS_HEADING}`, "");
  for (const item of plan.items) {
    lines.push(
      `- ${TASK_STATUS_MARKERS[item.status]} ${item.text} ${taskIdComment(item.id)}`,
      ...taskItemAttributeLines(item, plan.items),
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Reads a plan file. The title is the first `# ` heading. The to-dos are the
 * checkbox lines under a "To-dos" (or Tasks, Steps, Checklist) heading, up to
 * the next heading of the same or a higher level; without such a heading,
 * every checkbox line in the file. The body is everything else between the
 * title and the to-dos.
 */
export function parsePlanFile(markdown: string): PlanDocument {
  const lines = markdown.replace(/^﻿/, "").split(/\r?\n/);
  let title = "";
  let titleIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.+?)\s*#*\s*$/);
    if (match) {
      title = match[1].trim();
      titleIndex = i;
      break;
    }
  }

  let todosStart = -1;
  let todosEnd = lines.length;
  for (let i = titleIndex + 1; i < lines.length; i++) {
    const match = lines[i].match(TODOS_HEADING);
    if (match) {
      todosStart = i;
      const level = match[1].length;
      for (let j = i + 1; j < lines.length; j++) {
        const heading = lines[j].match(HEADING);
        if (heading && heading[1].length <= level) {
          todosEnd = j;
          break;
        }
      }
      break;
    }
  }

  let bodyLines: string[];
  let todoLines: string[];
  if (todosStart >= 0) {
    todoLines = lines.slice(todosStart + 1, todosEnd);
    bodyLines = [
      ...lines.slice(titleIndex + 1, todosStart),
      ...lines.slice(todosEnd),
    ];
  } else {
    const rest = lines.slice(titleIndex + 1);
    todoLines = rest.filter((line) => CHECKBOX_LINE.test(line));
    bodyLines = rest.filter((line) => !CHECKBOX_LINE.test(line));
  }

  return {
    title: title || "Plan",
    body: bodyLines.join("\n").trim(),
    items: parseMarkdownChecklist(todoLines.join("\n")),
  };
}

/** Applies the plan tool's `todo_details` to the to-dos; returns an error text. */
function todoDetails(
  value: unknown,
  items: TaskItemInput[],
): string | undefined {
  if (value === undefined || value === null) return undefined;
  let details: unknown = value;
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      return "todo_details must be an array";
    }
  }
  if (!Array.isArray(details)) return "todo_details must be an array";
  for (const detail of details) {
    const d = (detail ?? {}) as {
      todo?: unknown;
      after?: unknown;
      check?: unknown;
    };
    const n = Number(d.todo);
    if (!Number.isInteger(n) || n < 1 || n > items.length) {
      return `todo_details: todo must be a to-do number from 1 to ${items.length}`;
    }
    const item = items[n - 1];
    if (d.after !== undefined) item.after = d.after;
    if (d.check !== undefined) item.check = d.check;
  }
  return undefined;
}

function oneLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, " ");
}

export type PlanArgsResult =
  | { ok: true; title: string; body: string; items: TaskItemInput[] }
  | {
      ok: false;
      error: string;
    };

/**
 * Checks what the model sent to the plan tool: a title, the plan text and at
 * least one to-do. To-dos are strings (or `{ text, after?, check? }`), all
 * pending. `todo_details` adds `after` (1-based to-do numbers) and `check` (a
 * command that confirms the to-do is done) to to-dos sent as strings.
 */
export function validatePlanArgs(args: {
  title?: unknown;
  plan?: unknown;
  todos?: unknown;
  todo_details?: unknown;
}): PlanArgsResult {
  if (typeof args?.title !== "string" || !oneLine(args.title)) {
    return { ok: false, error: "title is required" };
  }
  const title = oneLine(args.title);
  if (title.length > PLAN_LIMITS.maxTitleLength) {
    return {
      ok: false,
      error: `title is longer than ${PLAN_LIMITS.maxTitleLength} characters`,
    };
  }
  const body = typeof args.plan === "string" ? args.plan.trim() : "";
  if (body.length > PLAN_LIMITS.maxBodyLength) {
    return {
      ok: false,
      error: `plan is longer than ${PLAN_LIMITS.maxBodyLength} characters. Keep it short: the to-dos carry the steps.`,
    };
  }

  let todos: unknown = args.todos;
  // Some models send the array as a JSON string.
  if (typeof todos === "string") {
    const raw = todos;
    try {
      todos = JSON.parse(raw);
    } catch {
      todos = parseMarkdownChecklist(raw).map((item) => item.text);
    }
  }
  if (!Array.isArray(todos) || todos.length === 0) {
    return { ok: false, error: "todos must be a non-empty array of strings" };
  }
  const items: TaskItemInput[] = [];
  for (const todo of todos) {
    const text =
      typeof todo === "string"
        ? todo
        : todo && typeof todo === "object" && "text" in todo
          ? (todo as { text: unknown }).text
          : undefined;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, error: "every to-do needs text" };
    }
    const extra =
      todo && typeof todo === "object"
        ? (todo as { after?: unknown; check?: unknown })
        : {};
    items.push({
      text,
      status: "pending",
      ...(extra.after !== undefined && { after: extra.after }),
      ...(extra.check !== undefined && { check: extra.check }),
    });
  }
  const details = todoDetails(args.todo_details, items);
  if (details) return { ok: false, error: details };
  if (items.length > TASK_PLAN_LIMITS.maxItems) {
    return {
      ok: false,
      error: `Too many to-dos (${items.length}); the limit is ${TASK_PLAN_LIMITS.maxItems}. Merge small steps.`,
    };
  }
  return { ok: true, title, body, items };
}

/**
 * The task list for a newly proposed plan: the plan's to-dos, replacing the
 * current list. Ids of items whose text matches the current list are kept.
 */
export function taskPlanForProposal(
  items: TaskItemInput[],
  previous: TaskPlan | undefined,
  now?: Date,
): TaskPlanResult {
  return buildTaskPlan(withPreviousIds(items, previous), {
    reset: true,
    updatedBy: "model",
    now,
  });
}

function withPreviousIds(
  items: TaskItemInput[],
  previous: TaskPlan | undefined,
): TaskItemInput[] {
  const explicit = new Set(
    items
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const used = new Set<string>();
  return items.map((item) => {
    if (item.id !== undefined) {
      return item;
    }
    const match = previous?.items.find(
      (p) => p.text === item.text && !used.has(p.id) && !explicit.has(p.id),
    );
    if (!match) {
      return item;
    }
    used.add(match.id);
    return { ...item, id: match.id };
  });
}

export interface PlanFileReadResult {
  ok: true;
  plan: TaskPlan;
  title: string;
  /** True when the file's to-dos differ from `previous` (the person edited them) */
  changed: boolean;
}

/**
 * The task list from a plan file read back at Build: the file's checkboxes,
 * in its order, are the list. Ids come from the file's id comments, or from
 * an item of `previous` with the same text; notes and activeForm labels are
 * kept from `previous` for items that kept their id. When the to-dos differ
 * from `previous`, the list is marked as edited by the user so the model is
 * told to keep the changes.
 */
export function taskPlanFromPlanFile(
  markdown: string,
  previous: TaskPlan | undefined,
  now?: Date,
): PlanFileReadResult | { ok: false; error: string } {
  const doc = parsePlanFile(markdown);
  const built = buildTaskPlan(withPreviousIds(doc.items, previous), {
    reset: true,
    updatedBy: "model",
    now,
  });
  if (!built.ok) {
    return built;
  }
  const previousById = new Map(previous?.items.map((i) => [i.id, i]));
  const items = built.plan.items.map((item) => {
    const before = previousById.get(item.id);
    if (!before) {
      return item;
    }
    return {
      ...item,
      ...(before.note &&
        item.status === before.status && { note: before.note }),
      ...(before.activeForm && { activeForm: before.activeForm }),
    };
  });
  const changed = !sameItems(items, previous?.items ?? []);
  return {
    ok: true,
    title: doc.title,
    changed,
    plan: {
      ...built.plan,
      items,
      updatedBy: changed ? "user" : (previous?.updatedBy ?? "model"),
    },
  };
}

function sameItems(a: TaskItem[], b: TaskItem[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, i) =>
        item.id === b[i].id &&
        item.text === b[i].text &&
        item.status === b[i].status,
    )
  );
}

/** The plan tool's description, shared by the IDE (present_plan) and the CLI (PresentPlan). */
export const PRESENT_PLAN_TOOL_DESCRIPTION = `Present your plan for the user's approval. Use it in Plan mode once you have researched enough to propose concrete work, instead of asking the user to switch modes.

It saves the plan as a markdown file in the workspace (${PLANS_DIR}/<title>.md), makes its to-dos the task list, and shows the plan to the user, who can edit the file and then choose Build (start implementing) or keep planning. Stop after calling it: do not start implementing.

- title: a short name for the work.
- plan: the plan in markdown, for a person to read: the goal, the approach, the files involved, risks or open questions. Keep it short; do not repeat the to-dos.
- todos: the implementation steps in order, one short line each. They become the task list you update while you build.
- todo_details (optional): for a to-do that must wait for others, its \`after\` (the numbers of the to-dos it comes after); for one that a command can verify, its \`check\` (a command that exits 0 when the to-do is done, such as a focused test run). Size each to-do as one reviewable change that one check can verify.

Calling it again with the same title replaces that plan file, so revise a plan by presenting it again.`;

/** The plan tool's `todo_details` parameter, shared by the IDE and the CLI. */
export const PRESENT_PLAN_TODO_DETAILS_PARAMETER = {
  type: "array",
  description:
    "Optional. Per to-do: after (numbers of the to-dos it comes after) and check (a command that exits 0 when it is done).",
  items: {
    type: "object",
    required: ["todo"],
    properties: {
      todo: { type: "number", description: "The to-do's number, from 1" },
      after: {
        type: "array",
        description: "Numbers of the to-dos this one comes after",
        items: { type: "number" },
      },
      check: {
        type: "string",
        description: "A command that exits 0 when this to-do is done",
      },
    },
  },
};

/** What the model gets back once the plan is saved and shown (IDE). */
export function planProposedResult(relativePath: string, plan: TaskPlan) {
  return `Plan saved to ${relativePath} and shown to the user, with its ${plan.items.length} to-dos as the task list. Stop here and wait: the user will edit the plan, choose Build, or ask for changes.`;
}

/**
 * The message Build sends (IDE), or the tool result after Build (CLI): what
 * to implement, and that the person may have edited the file.
 */
export function planBuildMessage(relativePath: string): string {
  return `Build the plan in ${relativePath}. Read the file first: I may have edited it since you wrote it, and its to-dos are already your task list (updated from the file). Implement the plan step by step and keep the task list current: mark each to-do in_progress when you start it and completed as soon as it is done. Do not recreate the list, and do not edit the plan file unless I ask.`;
}

/** What the model gets back when the person chooses to keep planning (CLI). */
export function planKeepPlanningResult(feedback?: string): string {
  const base =
    "The user wants to keep planning and has not approved the plan. Stay in Plan mode: do not implement anything.";
  return feedback?.trim()
    ? `${base} Their feedback: ${feedback.trim()}\nRevise the plan and present it again when it is ready.`
    : `${base} Ask what they would like changed, then present the revised plan again.`;
}
