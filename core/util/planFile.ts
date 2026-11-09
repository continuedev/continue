import type { QuestionType, TaskItem, TaskPlan } from "../index.js";
import { QUESTION_TYPES } from "./loopMode.js";
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
 *   after: 1
 *   check: npm test -- upload
 *   model: Claude Opus
 * ```
 *
 * The indented lines under a to-do are optional: `after:` (the to-dos it
 * waits for), `check:` (a command that confirms it is done) and `model:` (the
 * `name` of the chat model its Loop run goes to instead of `modeModels.loop`).
 */

/** Workspace-relative folder the plan files go in. */
export const PLANS_DIR = ".continuous/plans";

export const PLAN_TODOS_HEADING = "To-dos";
export const PLAN_DECISIONS_HEADING = "Decisions";

export const PLAN_LIMITS = {
  maxTitleLength: 120,
  /** The body is for people: a summary, the approach, the files involved. */
  maxBodyLength: 12_000,
  maxSlugLength: 60,
  /** Decisions left to the person; more than this and the plan is not ready. */
  maxDecisions: 5,
  maxDecisionLength: 400,
  maxDecisionOptions: 4,
} as const;

/**
 * A choice the plan leaves to the person: one they kept for themselves, or
 * one a wrong answer makes costly. Not a to-do: no check, no status. The
 * to-dos that depend on it wait for the answer (plans/policy-areas.md).
 */
export interface PlanDecision {
  /** The question, self-contained. */
  question: string;
  /** Two to four choices, the model's pick among them. */
  options?: string[];
  /** The model's recommendation. */
  pick?: string;
  /** What a wrong answer would cost. */
  type?: QuestionType;
  /** 1-based numbers of the to-dos that wait on this decision. */
  todos?: number[];
  /** The person's answer, once given (in the file or when approving). */
  answer?: string;
}

/** The plan tool's name in the IDE (snake_case like the other core tools). */
export const PRESENT_PLAN_TOOL_NAME = "present_plan";
/** The plan tool's name in the CLI (PascalCase like the other CLI tools). */
export const PRESENT_PLAN_CLI_TOOL_NAME = "PresentPlan";

export interface PlanDocument {
  title: string;
  body: string;
  /** In file order; ids where the file has them. */
  items: TaskItemInput[];
  /** The decisions left to the person, with any answers written in the file. */
  decisions: PlanDecision[];
}

/** A heading that starts the to-do list: To-dos, Todos, Tasks, Steps, Checklist. */
const TODOS_HEADING = /^(#{2,6})\s+(to-?dos?|tasks|steps|checklist)\s*:?\s*$/i;
/** The heading of the decisions section the plan tool writes. */
const DECISIONS_HEADING = /^(#{2,6})\s+decisions\s*:?\s*$/i;
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
  decisions?: PlanDecision[];
}): string {
  const lines = [`# ${oneLine(plan.title) || "Plan"}`, ""];
  const body = plan.body.trim();
  if (body) {
    lines.push(body, "");
  }
  if (plan.decisions?.length) {
    lines.push(`## ${PLAN_DECISIONS_HEADING}`, "");
    for (const decision of plan.decisions) {
      lines.push(...decisionLines(decision));
    }
    lines.push("");
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
 * The decision as plan-file lines: a bullet with the question, then indented
 * `key: value` bullets. Options are separated by " | ". A person edits the
 * answer line (or adds one) to settle it.
 *
 * ```markdown
 * - Which date format should formatDate return?
 *   - type: scope
 *   - options: ISO 8601 | November 8, 2026
 *   - pick: ISO 8601
 *   - to-dos: 1, 2
 *   - answer: ISO 8601
 * ```
 */
function decisionLines(decision: PlanDecision): string[] {
  const lines = [`- ${oneLine(decision.question)}`];
  if (decision.type) lines.push(`  - type: ${decision.type}`);
  if (decision.options?.length) {
    lines.push(`  - options: ${decision.options.map(oneLine).join(" | ")}`);
  }
  if (decision.pick) lines.push(`  - pick: ${oneLine(decision.pick)}`);
  if (decision.todos?.length) {
    lines.push(`  - to-dos: ${decision.todos.join(", ")}`);
  }
  if (decision.answer) lines.push(`  - answer: ${oneLine(decision.answer)}`);
  return lines;
}

/** The decisions section read back; tolerant of a person's edits. */
function parseDecisionLines(lines: string[]): PlanDecision[] {
  const decisions: PlanDecision[] = [];
  for (const raw of lines) {
    const top = raw.match(/^(?:[-*+]|\d+\.)\s+(.+?)\s*$/);
    const nested = raw.match(
      /^\s+(?:[-*+]|\d+\.)\s+([a-z -]+?)\s*:\s*(.*?)\s*$/i,
    );
    if (nested && decisions.length > 0) {
      const decision = decisions[decisions.length - 1];
      const key = nested[1].toLowerCase().replace(/\s+/g, "");
      const value = nested[2];
      if (key === "type") {
        const type = value.toLowerCase();
        if ((QUESTION_TYPES as readonly string[]).includes(type)) {
          decision.type = type as QuestionType;
        }
      } else if (key === "options") {
        const options = value
          .split("|")
          .map((o) => o.trim())
          .filter(Boolean);
        if (options.length) decision.options = options;
      } else if (key === "pick") {
        if (value) decision.pick = value;
      } else if (key === "to-dos" || key === "todos") {
        const todos = value
          .split(/[,\s]+/)
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0);
        if (todos.length) decision.todos = todos;
      } else if (key === "answer") {
        if (value) decision.answer = value;
      }
      continue;
    }
    if (top && !/^\s/.test(raw)) {
      // A person may tick the decision like a to-do; the box is not the answer
      const question = top[1].replace(/^\[[ xX]\]\s*/, "");
      if (question) decisions.push({ question });
    }
  }
  return decisions;
}

/**
 * Where a section starts and ends: the heading's line and the line of the
 * next heading at the same or a higher level (or the end of the file).
 */
function sectionBounds(
  lines: string[],
  from: number,
  heading: RegExp,
): { start: number; end: number } | undefined {
  for (let i = from; i < lines.length; i++) {
    const match = lines[i].match(heading);
    if (!match) continue;
    const level = match[1].length;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].match(HEADING);
      if (next && next[1].length <= level) {
        end = j;
        break;
      }
    }
    return { start: i, end };
  }
  return undefined;
}

/**
 * Reads a plan file. The title is the first `# ` heading. The to-dos are the
 * checkbox lines under a "To-dos" (or Tasks, Steps, Checklist) heading, up to
 * the next heading of the same or a higher level; without such a heading,
 * every checkbox line in the file. The decisions are the bullets under a
 * "Decisions" heading (see decisionLines). The body is everything else
 * between the title and the to-dos.
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

  const todos = sectionBounds(lines, titleIndex + 1, TODOS_HEADING);
  const decisionsSection = sectionBounds(
    lines,
    titleIndex + 1,
    DECISIONS_HEADING,
  );
  const taken = (i: number) =>
    (todos && i >= todos.start && i < todos.end) ||
    (decisionsSection &&
      i >= decisionsSection.start &&
      i < decisionsSection.end);

  let bodyLines: string[];
  let todoLines: string[];
  if (todos) {
    todoLines = lines.slice(todos.start + 1, todos.end);
    bodyLines = lines.filter((_, i) => i > titleIndex && !taken(i));
  } else {
    const rest = lines
      .map((line, i) => ({ line, i }))
      .filter(({ i }) => i > titleIndex && !taken(i))
      .map(({ line }) => line);
    todoLines = rest.filter((line) => CHECKBOX_LINE.test(line));
    bodyLines = rest.filter((line) => !CHECKBOX_LINE.test(line));
  }

  return {
    title: title || "Plan",
    body: bodyLines.join("\n").trim(),
    items: parseMarkdownChecklist(todoLines.join("\n")),
    decisions: decisionsSection
      ? parseDecisionLines(
          lines.slice(decisionsSection.start + 1, decisionsSection.end),
        )
      : [],
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
      model?: unknown;
    };
    const n = Number(d.todo);
    if (!Number.isInteger(n) || n < 1 || n > items.length) {
      return `todo_details: todo must be a to-do number from 1 to ${items.length}`;
    }
    const item = items[n - 1];
    if (d.after !== undefined) item.after = d.after;
    if (d.check !== undefined) item.check = d.check;
    if (d.model !== undefined) item.model = d.model;
  }
  return undefined;
}

function oneLine(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, " ");
}

/**
 * An array a model sent as text: JSON, or XML-shaped items (`<item>...</item>`,
 * with or without CDATA, each item JSON or plain text), as Claude Haiku 4.5
 * sent for `todos` and `decisions` in 2 of 3 live runs. Undefined when the
 * text is neither, so the caller can try its own format.
 */
function listFromText(raw: string): unknown[] | undefined {
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // not JSON
  }
  const items = [...text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(
    (m) => m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim(),
  );
  if (items.length === 0) return undefined;
  return items.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  });
}

export type PlanArgsResult =
  | {
      ok: true;
      title: string;
      body: string;
      items: TaskItemInput[];
      decisions: PlanDecision[];
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Checks the plan tool's `decisions`: each a question (or `{ question,
 * options?, pick?, type?, todos? }`), at most `maxDecisions`. Returns the
 * decisions or an error text.
 */
function planDecisions(
  value: unknown,
  itemCount: number,
): { decisions: PlanDecision[] } | { error: string } {
  if (value === undefined || value === null) return { decisions: [] };
  let list: unknown = value;
  if (typeof list === "string") {
    list = listFromText(list) ?? [list];
  }
  if (!Array.isArray(list)) return { error: "decisions must be an array" };
  if (list.length > PLAN_LIMITS.maxDecisions) {
    return {
      error: `Too many decisions (${list.length}); the limit is ${PLAN_LIMITS.maxDecisions}. Decide the small ones yourself and write them as assumptions.`,
    };
  }
  const decisions: PlanDecision[] = [];
  for (const entry of list) {
    const d =
      typeof entry === "string"
        ? { question: entry }
        : ((entry ?? {}) as Record<string, unknown>);
    const question =
      typeof d.question === "string" ? oneLine(d.question) : undefined;
    if (!question) return { error: "every decision needs a question" };
    if (question.length > PLAN_LIMITS.maxDecisionLength) {
      return {
        error: `a decision is longer than ${PLAN_LIMITS.maxDecisionLength} characters`,
      };
    }
    const decision: PlanDecision = { question };
    if (d.options !== undefined) {
      if (
        !Array.isArray(d.options) ||
        d.options.some((o) => typeof o !== "string" || !o.trim())
      ) {
        return { error: "decision options must be an array of strings" };
      }
      const options = d.options.map((o) => oneLine(o as string));
      if (options.length > PLAN_LIMITS.maxDecisionOptions) {
        return {
          error: `a decision has more than ${PLAN_LIMITS.maxDecisionOptions} options`,
        };
      }
      if (options.length) decision.options = options;
    }
    if (typeof d.pick === "string" && d.pick.trim()) {
      decision.pick = oneLine(d.pick);
    }
    if (d.type !== undefined) {
      if (
        typeof d.type !== "string" ||
        !(QUESTION_TYPES as readonly string[]).includes(d.type)
      ) {
        return {
          error: `decision type must be one of ${QUESTION_TYPES.join(", ")}`,
        };
      }
      decision.type = d.type as QuestionType;
    }
    if (d.todos !== undefined) {
      if (
        !Array.isArray(d.todos) ||
        d.todos.some(
          (n) =>
            !Number.isInteger(Number(n)) ||
            Number(n) < 1 ||
            Number(n) > itemCount,
        )
      ) {
        return {
          error: `decision todos must be to-do numbers from 1 to ${itemCount}`,
        };
      }
      const todos = [...new Set(d.todos.map(Number))];
      if (todos.length) decision.todos = todos;
    }
    decisions.push(decision);
  }
  return { decisions };
}

/**
 * Checks what the model sent to the plan tool: a title, the plan text and at
 * least one to-do. To-dos are strings (or `{ text, after?, check?, model? }`),
 * all pending. `todo_details` adds `after` (1-based to-do numbers), `check` (a
 * command that confirms the to-do is done) and `model` (the chat model its
 * Loop run goes to) to to-dos sent as strings.
 * `decisions` are the choices left to the person (planDecisions).
 */
export function validatePlanArgs(args: {
  title?: unknown;
  plan?: unknown;
  todos?: unknown;
  todo_details?: unknown;
  decisions?: unknown;
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
  // Some models send the array as a string: JSON, XML items or a list.
  if (typeof todos === "string") {
    todos =
      listFromText(todos) ??
      parseMarkdownChecklist(todos).map((item) => item.text);
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
        ? (todo as { after?: unknown; check?: unknown; model?: unknown })
        : {};
    items.push({
      text,
      status: "pending",
      ...(extra.after !== undefined && { after: extra.after }),
      ...(extra.check !== undefined && { check: extra.check }),
      ...(extra.model !== undefined && { model: extra.model }),
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
  const decided = planDecisions(args.decisions, items.length);
  if ("error" in decided) return { ok: false, error: decided.error };
  return { ok: true, title, body, items, decisions: decided.decisions };
}

/** The decisions with the person's answers merged in by question text. */
export function answeredDecisions(
  decisions: PlanDecision[],
  answers: { question: string; answer: string }[],
): PlanDecision[] {
  return decisions.map((decision) => {
    const given = answers.find((a) => a.question === decision.question);
    return given?.answer ? { ...decision, answer: given.answer } : decision;
  });
}

/**
 * The decisions as lines for the model: what the person answered, or, for
 * one still open, that the pick stands unless the file says otherwise.
 */
export function describeDecisions(decisions: PlanDecision[]): string {
  if (decisions.length === 0) return "";
  // An open decision is the person's: the pick is not a default to go on
  // with, or the plan turn's assume-fallback comes back through this door.
  const lines = decisions.map((d, i) => {
    const todos = d.todos?.length ? ` (to-dos ${d.todos.join(", ")})` : "";
    if (d.answer)
      return `${i + 1}. ${d.question}${todos}: decided: ${d.answer}`;
    const hold = d.todos?.length
      ? ` Do not start to-dos ${d.todos.join(", ")} until it is decided.`
      : " Do not settle it.";
    return `${i + 1}. ${d.question}${todos}: open; the person has not decided.${hold}`;
  });
  return `Decisions:\n${lines.join("\n")}`;
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
- todo_details (optional): for a to-do that must wait for others, its \`after\` (the numbers of the to-dos it comes after); for one that a command can verify, its \`check\` (a command that exits 0 when the to-do is done, such as a focused test run); for one that needs a stronger or cheaper model than the rest, its \`model\` (the name of one of the user's chat models; a loop runs that to-do on it). Size each to-do as one reviewable change that one check can verify.
- decisions (optional): the choices left to the person: one they kept for themselves, or one a wrong answer makes costly (irreversible, security, cost, scope). Each has a self-contained question, two to four options, your pick, its type and the numbers of the to-dos that wait on it. A decision is not a to-do: it has no check and no status. Small choices are yours: decide them and write them in the plan as assumptions.

Calling it again with the same title replaces that plan file, so revise a plan by presenting it again.`;

/** The plan tool's `decisions` parameter, shared by the IDE and the CLI. */
export const PRESENT_PLAN_DECISIONS_PARAMETER = {
  type: "array",
  description: `Optional. Choices left to the person, at most ${PLAN_LIMITS.maxDecisions}: each a self-contained question with options, your pick, its type and the to-dos that wait on it.`,
  items: {
    type: "object",
    required: ["question"],
    properties: {
      question: {
        type: "string",
        description: `The choice, self-contained, at most ${PLAN_LIMITS.maxDecisionLength} characters`,
      },
      options: {
        type: "array",
        description: "Two to four choices",
        items: { type: "string" },
      },
      pick: { type: "string", description: "Your recommendation" },
      type: {
        type: "string",
        enum: [...QUESTION_TYPES],
        description: "What a wrong answer would cost",
      },
      todos: {
        type: "array",
        description: "Numbers of the to-dos that wait on this decision",
        items: { type: "number" },
      },
    },
  },
};

/** The plan tool's `todo_details` parameter, shared by the IDE and the CLI. */
export const PRESENT_PLAN_TODO_DETAILS_PARAMETER = {
  type: "array",
  description:
    "Optional. Per to-do: after (numbers of the to-dos it comes after), check (a command that exits 0 when it is done) and model (the name of the chat model a loop runs it with).",
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
      model: {
        type: "string",
        description:
          "The name of the chat model a loop runs this to-do with, instead of its usual one",
      },
    },
  },
};

/** What the model gets back once the plan is saved and shown (IDE). */
export function planProposedResult(
  relativePath: string,
  plan: TaskPlan,
  decisions: PlanDecision[] = [],
) {
  const open =
    decisions.length > 0
      ? ` Its ${decisions.length === 1 ? "decision waits" : `${decisions.length} decisions wait`} for the user; do not settle ${decisions.length === 1 ? "it" : "them"} yourself.`
      : "";
  return `Plan saved to ${relativePath} and shown to the user, with its ${plan.items.length} to-dos as the task list.${open} Stop here and wait: the user will edit the plan, choose Build, or ask for changes.`;
}

/**
 * The message Build sends (IDE), or the tool result after Build (CLI): what
 * to implement, and that the person may have edited the file.
 */
export function planBuildMessage(relativePath: string): string {
  return `Build the plan in ${relativePath}. Read the file first: I may have edited it since you wrote it, and its to-dos are already your task list (updated from the file). Work through the to-dos in order and keep the task list current: mark each to-do in_progress when you start it and completed as soon as it is done. Do not ask whether to start, do not recreate the list, and do not edit the plan file unless I ask.`;
}

/** What the model gets back when the person chooses to keep planning (CLI). */
export function planKeepPlanningResult(feedback?: string): string {
  const base =
    "The user wants to keep planning and has not approved the plan. Stay in Plan mode: do not implement anything.";
  return feedback?.trim()
    ? `${base} Their feedback: ${feedback.trim()}\nRevise the plan and present it again when it is ready.`
    : `${base} Ask what they would like changed, then present the revised plan again.`;
}
