import type {
  LoopAnswer,
  LoopAnswerRoute,
  LoopAutonomy,
  LoopBudget,
  LoopItemState,
  LoopItemStatus,
  LoopQuestion,
  LoopQuestionKind,
  LoopState,
  LoopStopReason,
  TaskItem,
  TaskPlan,
} from "../index.js";
import { stableStringify } from "../tools/permissions/auto/state.js";

/**
 * Loop mode: build a plan item by item without the person driving each step.
 * The extension, not the model, runs the loop: it picks the next item that is
 * not waiting, runs it with a short one-item prompt, records questions the
 * model holds for the person, routes the person's answers by the state of the
 * item they are about, and re-plans in a read-only Plan-mode turn when no
 * item is left to run. Everything here is pure; the gui (and later the CLI)
 * applies the results. Design: plans/loop-mode.md.
 */

export const HOLD_QUESTION_TOOL_NAME = "hold_question";
export const FINISH_ITEM_TOOL_NAME = "finish_item";

/**
 * Same tool and same arguments: the key of an approval grant and of the
 * repeat count. The same format as the gui's grantKey.
 */
export function loopCallKey(toolName: string, args: unknown): string {
  return `${toolName}\u0000${stableStringify(args ?? {})}`;
}

/**
 * The key an "Allow once" grant is kept under: the tool and what its
 * approval question names (the command, or the file), not every argument.
 * A model that writes the file again with slightly different content still
 * gets the write the person allowed. `resolvePath` makes a relative path
 * absolute, so "src/a.ts" and its absolute form are one file.
 */
export function loopGrantKey(
  toolName: string,
  args: unknown,
  resolvePath: (path: string) => string = (path) => path,
): string {
  const a = (args ?? {}) as Record<string, unknown>;
  if (typeof a.command === "string" && a.command.trim()) {
    return loopCallKey(toolName, { command: a.command.trim() });
  }
  for (const key of ["filepath", "file_path", "path"]) {
    const value = a[key];
    if (typeof value === "string" && value.trim()) {
      const path = resolvePath(value.trim())
        .replace(/[\\/]+/g, "/")
        .replace(/^([a-z]):/, (_, d: string) => `${d.toUpperCase()}:`);
      return loopCallKey(toolName, { path });
    }
  }
  return loopCallKey(toolName, args);
}

export const DEFAULT_LOOP_BUDGET: LoopBudget = {
  maxRounds: 5,
  maxTokens: 10_000_000,
  maxWallMs: 2 * 60 * 60 * 1000,
  maxAttempts: 2,
  maxNoProgressRounds: 2,
  maxConsecutiveFailures: 3,
  maxItemTurns: 60,
};

const HOUR = 60 * 60 * 1000;

export interface LoopAutonomyPreset {
  label: string;
  /** One line for the picker */
  description: string;
  /**
   * Which re-plans start the next round without the person:
   * - ask: none, the plan card waits for Continue the loop;
   * - no-new-scope: one whose to-dos were all in the previous list;
   * - bounded: one that adds at most maxNewItemsPerReplan to-dos.
   */
  replan: "ask" | "no-new-scope" | "bounded";
  maxNewItemsPerReplan: number;
  /**
   * When every open item waits on the person this long with no answer, the
   * items go on with their best default (0: wait for as long as it takes).
   * The questions stay open, so a late answer still redoes the item.
   */
  waitTimeoutMs: number;
  budget: LoopBudget;
}

/**
 * The autonomy levels. Whatever the level, these hold: deny rules, protected
 * paths and ask rules still decide; a call left for the person is held as a
 * question, never run; nothing is ever confirmed on the person's behalf; and
 * the budgets, the no-progress and failure limits and the repeat limit stop
 * the loop. Design: plans/loop-mode.md, "Autonomy".
 */
export const LOOP_AUTONOMY: Record<LoopAutonomy, LoopAutonomyPreset> = {
  supervised: {
    label: "Supervised",
    description: "Every re-plan waits for you; questions wait for you.",
    replan: "ask",
    maxNewItemsPerReplan: 0,
    waitTimeoutMs: 0,
    budget: {
      ...DEFAULT_LOOP_BUDGET,
      maxRounds: 3,
      maxTokens: 5_000_000,
      maxWallMs: HOUR,
    },
  },
  auto: {
    label: "Auto",
    description:
      "Re-plans that add no new work go on by themselves; questions wait for you.",
    replan: "no-new-scope",
    maxNewItemsPerReplan: 0,
    waitTimeoutMs: 0,
    budget: DEFAULT_LOOP_BUDGET,
  },
  unattended: {
    label: "Unattended",
    description:
      "Re-plans that add up to 5 to-dos go on by themselves; after 15 minutes without an answer, items go on with their best default.",
    replan: "bounded",
    maxNewItemsPerReplan: 5,
    waitTimeoutMs: 15 * 60 * 1000,
    budget: {
      ...DEFAULT_LOOP_BUDGET,
      maxRounds: 10,
      maxTokens: 20_000_000,
      maxWallMs: 8 * HOUR,
    },
  },
};

export const LOOP_AUTONOMY_LEVELS: readonly LoopAutonomy[] = [
  "supervised",
  "auto",
  "unattended",
];

/** The level a loop starts at, from the approval mode in force. */
export function loopAutonomyFor(
  approvalMode: "manual" | "autoApprove" | "auto" | "yolo" | undefined,
): LoopAutonomy {
  switch (approvalMode) {
    case "yolo":
      return "unattended";
    case "auto":
    case "autoApprove":
      return "auto";
    default:
      return "supervised";
  }
}

export function loopAutonomy(loop: LoopState): LoopAutonomyPreset {
  return LOOP_AUTONOMY[loop.autonomy ?? "auto"];
}

/** Changes the level of a running loop; the budgets become that level's. */
export function setLoopAutonomy(
  loop: LoopState,
  autonomy: LoopAutonomy,
): LoopState {
  return { ...loop, autonomy, budget: { ...LOOP_AUTONOMY[autonomy].budget } };
}

export const LOOP_LIMITS = {
  maxQuestionLength: 1000,
  maxAnswerLength: 4000,
  maxSummaryLength: 500,
  /** Open questions one item may hold; more means the item is underspecified */
  maxOpenQuestionsPerItem: 4,
  /** Questions the whole loop may hold before new ones are refused */
  maxQuestions: 40,
  /** Notes carried to later items; kept short, as they go with every run */
  maxNoteLength: 300,
  maxNotes: 12,
} as const;

/**
 * Identical calls in one item's run before the next one is refused. The
 * repetition counters in OpenHands' stuck detector use 3 to 4; see
 * plans/loop-mode.md.
 */
export const LOOP_REPEAT_LIMIT = 4;

/**
 * How many times this call has been made in the run, counting it: `previous`
 * are the keys (tool name plus normalised arguments) of the run's earlier
 * calls.
 */
export function repeatCount(previous: string[], key: string): number {
  return previous.filter((k) => k === key).length + 1;
}

/** What the model sees when a call is refused for repeating. */
export function repeatedCallResult(toolName: string, count: number): string {
  return `${toolName} was not run: the same call has run ${count - 1} times with no file change in between, and its last result is above. A different check of your current explanation would return new information. If nothing is left to check, call ${FINISH_ITEM_TOOL_NAME} with outcome "stuck" and say what is in the way.`;
}

/** The report of a run that kept repeating a call after it was refused. */
export function repeatedCallReport(toolName: string): {
  outcome: FinishOutcome;
  summary: string;
} {
  return {
    outcome: "stuck",
    summary: `Kept repeating ${toolName} with no file change after it was refused.`,
  };
}

/** Requests past maxItemTurns before the run is ended for not reporting. */
export const LOOP_ITEM_TURN_GRACE = 10;

/**
 * Where a run stands against its turn limit, counting the request just made:
 * ok; wrap-up, when reading and searching stop but writing goes on, so work
 * already researched still gets written; or end, when it kept going and the
 * run is ended as stuck.
 */
export function itemTurnState(
  loop: LoopState,
  turns: number,
): "ok" | "wrap-up" | "end" {
  const limit = loop.budget.maxItemTurns ?? DEFAULT_LOOP_BUDGET.maxItemTurns;
  if (limit <= 0 || turns < limit) return "ok";
  return turns >= limit + LOOP_ITEM_TURN_GRACE ? "end" : "wrap-up";
}

/** What the model sees when a call is refused at the turn limit. */
export function itemTurnLimitResult(turns: number): string {
  return `You have made ${turns} requests on this item, so this call was not run. Stop reading and searching. Write what the item needs now, in as few calls as you can, then call ${FINISH_ITEM_TOOL_NAME}: outcome "done" if the item is finished, otherwise "stuck" and say what is left.`;
}

/** The report of a run ended at its turn limit. */
export function itemTurnLimitReport(turns: number): {
  outcome: FinishOutcome;
  summary: string;
} {
  return {
    outcome: "stuck",
    summary: `Ended after ${turns} requests without reporting.`,
  };
}

/** A held call, as the person reads it in the inbox: what would actually run. */
export function describeHeldCall(name: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  if (typeof a.command === "string") return a.command;
  const json = JSON.stringify(a);
  return json && json !== "{}" ? `${name} ${json}` : name;
}

/** What the model sees when a re-plan turn tries a call that would ask. */
export const REPLAN_HOLD_RESULT =
  "Re-planning only reads, so this call was not run. Present the plan with present_plan instead.";

export type FinishOutcome = "done" | "stuck" | "waiting";

/** What the loop should do next; see decideNext. */
export type LoopAction =
  | { kind: "run"; itemId: string }
  | { kind: "replan" }
  /** until: when an unattended loop stops waiting and goes on without answers */
  | { kind: "wait"; until?: string }
  /** Unattended: the wait ran out; the waiting items go on (proceedUnanswered) */
  | { kind: "proceed" }
  | { kind: "stop"; reason: LoopStopReason; detail: string }
  | { kind: "none" };

export interface LoopContext {
  now: Date;
  /** Prompt plus completion tokens the session has used so far */
  sessionTokens: number;
}

const OPEN_STATUSES: LoopItemStatus[] = ["pending", "redo"];

function iso(now: Date): string {
  return now.toISOString();
}

function nextId(prefix: string, existing: { id: string }[]): string {
  let max = 0;
  for (const { id } of existing) {
    if (id.startsWith(prefix)) {
      const n = Number(id.slice(prefix.length));
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return `${prefix}${max + 1}`;
}

function itemState(loop: LoopState, id: string): LoopItemState | undefined {
  return loop.items.find((i) => i.id === id);
}

function withItem(
  loop: LoopState,
  id: string,
  change: Partial<LoopItemState>,
): LoopState {
  return {
    ...loop,
    items: loop.items.map((i) => (i.id === id ? { ...i, ...change } : i)),
  };
}

/** Item state for a task list item the loop has not seen. */
function fromTask(task: TaskItem): LoopItemState {
  const done = task.status === "completed" || task.status === "cancelled";
  return { id: task.id, status: done ? "done" : "pending", attempts: 0 };
}

/** Starts a loop on a plan's to-dos. Completed and cancelled items count as done. */
export function createLoop(
  plan: TaskPlan,
  options: {
    now: Date;
    sessionTokens: number;
    budget?: Partial<LoopBudget>;
    /** Default auto; see loopAutonomyFor */
    autonomy?: LoopAutonomy;
    /** false: items share the session's conversation (default: a fresh context) */
    freshContext?: boolean;
  },
): LoopState {
  return {
    status: "running",
    round: 1,
    startedAt: iso(options.now),
    tokensAtStart: options.sessionTokens,
    budget: {
      ...LOOP_AUTONOMY[options.autonomy ?? "auto"].budget,
      ...options.budget,
    },
    autonomy: options.autonomy ?? "auto",
    items: plan.items.map(fromTask),
    questions: [],
    answers: [],
    doneThisRound: 0,
    noProgressRounds: 0,
    grants: [],
    freshContext: options.freshContext ?? true,
    notes: [],
  };
}

/**
 * Brings the loop up to date with the task list, which the person may have
 * edited: items it has not seen join as pending, items gone from the list are
 * dropped, and an item the person marked completed or cancelled is done.
 */
export function reconcileLoop(loop: LoopState, plan: TaskPlan): LoopState {
  const items = plan.items.map((task) => {
    const known = itemState(loop, task.id);
    if (!known) return fromTask(task);
    if (
      (task.status === "completed" || task.status === "cancelled") &&
      known.status !== "running" &&
      known.status !== "done"
    ) {
      return { ...known, status: "done" as const };
    }
    return known;
  });
  return { ...loop, items };
}

/** The first item, in plan order, that can run now. */
export function nextRunnableItem(
  loop: LoopState,
  plan: TaskPlan,
): TaskItem | undefined {
  return plan.items.find((task) => {
    const state = itemState(loop, task.id);
    return state !== undefined && OPEN_STATUSES.includes(state.status);
  });
}

/**
 * What counts against the token budget: output, and input the provider did not
 * read from its cache. Every request re-sends the conversation, so counting
 * whole prompts charges the same text again each time: in a sandbox run on a
 * local model, about 90% of the prompt tokens of a request were cached.
 */
export function loopTokensFromUsage(usage: {
  promptTokens: number;
  completionTokens: number;
  promptTokensDetails?: { cachedTokens?: number };
}): number {
  const cached = usage.promptTokensDetails?.cachedTokens ?? 0;
  return Math.max(0, usage.promptTokens - cached) + usage.completionTokens;
}

/** Tokens the loop has used, from the session's running total. */
export function loopTokensUsed(loop: LoopState, sessionTokens: number): number {
  return Math.max(0, sessionTokens - loop.tokensAtStart);
}

function budgetStop(
  loop: LoopState,
  ctx: LoopContext,
): { reason: LoopStopReason; detail: string } | undefined {
  const { budget } = loop;
  const used = loopTokensUsed(loop, ctx.sessionTokens);
  if (budget.maxTokens > 0 && used >= budget.maxTokens) {
    return {
      reason: "tokens",
      detail: `The loop used ${used} tokens; its budget is ${budget.maxTokens}.`,
    };
  }
  const elapsed = ctx.now.getTime() - new Date(loop.startedAt).getTime();
  if (budget.maxWallMs > 0 && elapsed >= budget.maxWallMs) {
    return {
      reason: "time",
      detail: `The loop ran for ${Math.round(elapsed / 60000)} minutes; its budget is ${Math.round(budget.maxWallMs / 60000)}.`,
    };
  }
  return undefined;
}

function hasUndeliveredPlanAnswers(loop: LoopState): boolean {
  return loop.answers.some((a) => a.route === "replan" && !a.delivered);
}

/**
 * What to do when nothing is running. In order: budgets; a plan-wide answer
 * that asked to re-plan now; the next runnable item; done when every item is
 * done and no plan-wide answer is waiting; wait when every open item waits on
 * the person; otherwise re-plan, unless the rounds or the no-progress limit
 * say stop.
 */
export function decideNext(
  loop: LoopState,
  plan: TaskPlan,
  ctx: LoopContext,
): LoopAction {
  if (loop.status === "stopped" || loop.status === "awaiting_plan") {
    return { kind: "none" };
  }
  if (loop.current) {
    return { kind: "none" };
  }
  if (loop.stopRequested) {
    return { kind: "stop", reason: "stopped", detail: "You stopped the loop." };
  }
  const overBudget = budgetStop(loop, ctx);
  if (overBudget) {
    return { kind: "stop", ...overBudget };
  }
  const maxFailures =
    loop.budget.maxConsecutiveFailures ??
    DEFAULT_LOOP_BUDGET.maxConsecutiveFailures;
  if (maxFailures > 0 && (loop.consecutiveFailures ?? 0) >= maxFailures) {
    return {
      kind: "stop",
      reason: "failures",
      detail: `${loop.consecutiveFailures} items in a row failed.`,
    };
  }

  const live = loop.items.filter((i) => plan.items.some((t) => t.id === i.id));
  if (loop.replanRequested) {
    return replanOrStop(loop);
  }
  const next = nextRunnableItem(loop, plan);
  if (next) {
    return { kind: "run", itemId: next.id };
  }
  if (live.every((i) => i.status === "done")) {
    if (hasUndeliveredPlanAnswers(loop)) {
      return replanOrStop(loop);
    }
    return {
      kind: "stop",
      reason: "done",
      detail: `All ${live.length} items are done.`,
    };
  }
  const open = live.filter((i) => i.status !== "done");
  if (open.every((i) => i.status === "waiting")) {
    const { waitTimeoutMs } = loopAutonomy(loop);
    if (waitTimeoutMs <= 0) return { kind: "wait" };
    const since = new Date(loop.waitingSince ?? ctx.now).getTime();
    if (ctx.now.getTime() - since >= waitTimeoutMs) return { kind: "proceed" };
    return { kind: "wait", until: iso(new Date(since + waitTimeoutMs)) };
  }
  return replanOrStop(loop);
}

function replanOrStop(loop: LoopState): LoopAction {
  if (loop.round >= loop.budget.maxRounds) {
    return {
      kind: "stop",
      reason: "rounds",
      detail: `The loop reached its limit of ${loop.budget.maxRounds} rounds.`,
    };
  }
  // A round that finished nothing counts now, before paying for a re-plan.
  if (
    loop.doneThisRound === 0 &&
    loop.noProgressRounds + 1 >= loop.budget.maxNoProgressRounds
  ) {
    return {
      kind: "stop",
      reason: "no_progress",
      detail: `${loop.noProgressRounds + 1} rounds in a row finished no item.`,
    };
  }
  return { kind: "replan" };
}

export function stopLoop(
  loop: LoopState,
  reason: LoopStopReason,
  detail: string,
): LoopState {
  const items = loop.current?.itemId
    ? loop.items.map((i) =>
        i.id === loop.current?.itemId && i.status === "running"
          ? { ...i, status: "pending" as const }
          : i,
      )
    : loop.items;
  return {
    ...loop,
    items,
    current: undefined,
    status: "stopped",
    stopRequested: undefined,
    waitingSince: undefined,
    stopReason: reason,
    stopDetail: detail,
  };
}

/** Resumes a stopped or waiting loop; the budgets restart from now. */
export function resumeLoop(loop: LoopState, ctx: LoopContext): LoopState {
  return {
    ...loop,
    status: "running",
    stopReason: undefined,
    stopDetail: undefined,
    startedAt: iso(ctx.now),
    tokensAtStart: ctx.sessionTokens,
    noProgressRounds: 0,
    consecutiveFailures: 0,
    waitingSince: undefined,
  };
}

/** Every open item waits on the person: pause, remembering since when. */
export function enterWait(loop: LoopState, now: Date): LoopState {
  return {
    ...loop,
    status: "waiting",
    waitingSince: loop.waitingSince ?? iso(now),
  };
}

/**
 * Unattended, and the wait ran out: each waiting item goes on with its best
 * default. Its questions stay open, so an answer that comes later is still
 * routed (a done item is then redone). Nothing is confirmed.
 */
export function proceedUnanswered(loop: LoopState): LoopState {
  const items = loop.items.map((item) => {
    if (item.status !== "waiting") return item;
    const unanswered = openQuestions(loop, item.id).map((q) => q.id);
    return {
      ...item,
      status: "pending" as const,
      attempts: 0,
      ...(unanswered.length ? { unanswered } : {}),
    };
  });
  return { ...loop, items, status: "running", waitingSince: undefined };
}

/**
 * A re-plan ended with a plan: may it start the next round by itself? That
 * depends on the loop's autonomy level; anything else waits on the plan card.
 */
export function replanDecision(
  loop: LoopState,
  previousTexts: string[],
  plan: TaskPlan,
): { accept: boolean; reason: string } {
  const preset = loopAutonomy(loop);
  const known = new Set(previousTexts);
  const added = plan.items.filter((i) => !known.has(i.text)).length;
  switch (preset.replan) {
    case "ask":
      return {
        accept: false,
        reason: "Supervised: every re-plan waits for you.",
      };
    case "no-new-scope":
      return added === 0
        ? { accept: true, reason: "The re-plan adds no new to-dos." }
        : {
            accept: false,
            reason: `The re-plan adds ${added} new to-do${added === 1 ? "" : "s"}.`,
          };
    case "bounded":
      return added <= preset.maxNewItemsPerReplan
        ? {
            accept: true,
            reason: `The re-plan adds ${added} new to-do${added === 1 ? "" : "s"}, within ${preset.maxNewItemsPerReplan}.`,
          }
        : {
            accept: false,
            reason: `The re-plan adds ${added} new to-do${added === 1 ? "" : "s"}, more than ${preset.maxNewItemsPerReplan}.`,
          };
  }
}

export function startItemRun(
  loop: LoopState,
  itemId: string,
  historyIndex: number,
  now: Date,
): LoopState {
  const state = itemState(loop, itemId);
  return {
    ...withItem(loop, itemId, {
      status: "running",
      attempts: (state?.attempts ?? 0) + 1,
    }),
    status: "running",
    current: { kind: "item", itemId, historyIndex, startedAt: iso(now) },
  };
}

export function startReplan(
  loop: LoopState,
  historyIndex: number,
  now: Date,
): LoopState {
  return {
    ...loop,
    status: "replanning",
    replanRequested: false,
    current: { kind: "replan", historyIndex, startedAt: iso(now) },
    answers: loop.answers.map((a) =>
      a.route === "replan" ? { ...a, delivered: true } : a,
    ),
  };
}

function openQuestions(loop: LoopState, itemId: string): LoopQuestion[] {
  return loop.questions.filter((q) => q.itemId === itemId && !q.answerId);
}

function hasOpenBlocking(loop: LoopState, itemId: string): boolean {
  return openQuestions(loop, itemId).some(
    (q) => q.kind === "blocking" || q.kind === "approval",
  );
}

/**
 * The running item's turn ended. `report` is what finish_item said, if it was
 * called. Without a report the item runs again, up to maxAttempts, then is
 * failed. An item with an open blocking question waits whatever it reported,
 * unless it says it is done.
 */
export function finishItemRun(
  loop: LoopState,
  report:
    { outcome: FinishOutcome; summary?: string; notes?: string } | undefined,
): LoopState {
  const itemId = loop.current?.itemId;
  if (!itemId || loop.current?.kind !== "item") return loop;
  const state = itemState(loop, itemId);
  const summary = report?.summary?.slice(0, LOOP_LIMITS.maxSummaryLength);
  let status: LoopItemStatus;
  if (report?.outcome === "done") {
    status = "done";
  } else if (hasOpenBlocking(loop, itemId) || report?.outcome === "waiting") {
    status = "waiting";
  } else if (report?.outcome === "stuck") {
    status = "failed";
  } else {
    status =
      (state?.attempts ?? 0) >= loop.budget.maxAttempts ? "failed" : "pending";
  }
  const next = withItem(loop, itemId, {
    status,
    summary:
      summary ??
      (report ? state?.summary : "The turn ended without finish_item."),
  });
  const note = report?.notes?.trim().replace(/\s+/g, " ");
  const notes = note
    ? [...(loop.notes ?? []), note.slice(0, LOOP_LIMITS.maxNoteLength)].slice(
        -LOOP_LIMITS.maxNotes,
      )
    : loop.notes;
  const failures =
    status === "failed"
      ? (loop.consecutiveFailures ?? 0) + 1
      : status === "done"
        ? 0
        : (loop.consecutiveFailures ?? 0);
  return {
    ...withItem(next, itemId, { unanswered: undefined }),
    current: undefined,
    doneThisRound: loop.doneThisRound + (status === "done" ? 1 : 0),
    consecutiveFailures: failures,
    ...(notes ? { notes } : {}),
  };
}

/**
 * "Stop loop": stop at once when nothing runs, otherwise once the running
 * item or re-plan ends (decideNext then stops).
 */
export function requestStop(loop: LoopState): LoopState {
  if (!loop.current) return stopLoop(loop, "stopped", "You stopped the loop.");
  return { ...loop, stopRequested: true };
}

/** Stop pressed during an item: it goes back to pending and the loop stops. */
export function interruptLoop(loop: LoopState): LoopState {
  return stopLoop(loop, "stopped", "You stopped the loop.");
}

export type HoldResult =
  | { ok: true; loop: LoopState; question: LoopQuestion; duplicate: boolean }
  | { ok: false; error: string };

/** Records a question the running item holds for the person. */
export function holdQuestion(
  loop: LoopState,
  input: {
    itemId?: string;
    question: unknown;
    kind: unknown;
    assumption?: unknown;
    approval?: LoopQuestion["approval"];
  },
  now: Date,
): HoldResult {
  const question =
    typeof input.question === "string" ? input.question.trim() : "";
  if (!question) return { ok: false, error: "question is empty" };
  if (question.length > LOOP_LIMITS.maxQuestionLength) {
    return {
      ok: false,
      error: `question is longer than ${LOOP_LIMITS.maxQuestionLength} characters`,
    };
  }
  const kind = input.kind as LoopQuestionKind;
  if (kind !== "blocking" && kind !== "assumption" && kind !== "approval") {
    return { ok: false, error: 'kind must be "blocking" or "assumption"' };
  }
  const assumption =
    typeof input.assumption === "string" ? input.assumption.trim() : "";
  if (kind === "assumption" && !assumption) {
    return {
      ok: false,
      error:
        "An assumption question needs `assumption`: the default you are continuing with.",
    };
  }
  const itemId = input.itemId;
  const same = loop.questions.find(
    (q) => q.itemId === itemId && q.question === question && !q.answerId,
  );
  if (same) {
    return { ok: true, loop, question: same, duplicate: true };
  }
  if (
    itemId &&
    openQuestions(loop, itemId).length >= LOOP_LIMITS.maxOpenQuestionsPerItem
  ) {
    return {
      ok: false,
      error: `This item already holds ${LOOP_LIMITS.maxOpenQuestionsPerItem} open questions. Continue on your stated assumptions, or call ${FINISH_ITEM_TOOL_NAME} with outcome "waiting".`,
    };
  }
  if (loop.questions.length >= LOOP_LIMITS.maxQuestions) {
    return {
      ok: false,
      error: `The loop already holds ${LOOP_LIMITS.maxQuestions} questions. Continue on a stated assumption.`,
    };
  }
  const held: LoopQuestion = {
    id: nextId("q", loop.questions),
    ...(itemId ? { itemId } : {}),
    question,
    kind,
    ...(assumption ? { assumption } : {}),
    ...(input.approval ? { approval: input.approval } : {}),
    askedAt: iso(now),
  };
  return {
    ok: true,
    loop: { ...loop, questions: [...loop.questions, held] },
    question: held,
    duplicate: false,
  };
}

export type AnswerResult =
  | { ok: true; loop: LoopState; answer: LoopAnswer }
  | { ok: false; error: string };

/**
 * The person answered a question, or wrote about an item or the plan. Where
 * the answer goes depends on the item's state now:
 *
 * - waiting or failed: the item runs again with the answer (requeue);
 * - not run yet: the answer goes with its run (next-run);
 * - running: steered in at its next tool boundary (steer);
 * - done: a confirmed assumption changes nothing; anything else reopens it as
 *   redo;
 * - no item: read at the next re-plan, or at once with replanNow; or, with
 *   standing, sent with every item from now on (Ralph's "signs").
 *
 * An approval answer that allows the call adds its grant, so the call runs
 * without asking when the item tries it again.
 */
export interface LoopAnswerInput {
  questionId?: string;
  itemId?: string;
  text: string;
  confirm?: boolean;
  approve?: boolean;
  replanNow?: boolean;
  /** For a note with no item: an instruction for every item from now on */
  standing?: boolean;
}

/** The answer's text: what the person wrote, or what their button means. */
function answerText(
  question: LoopQuestion | undefined,
  input: LoopAnswerInput,
): string {
  const text = input.text.trim();
  if (text) return text;
  if (input.confirm && question?.assumption) {
    return `Keep the assumption: ${question.assumption}`;
  }
  if (question?.kind === "approval" && input.approve !== undefined) {
    return input.approve ? "Allowed." : "Not allowed.";
  }
  return "";
}

/** Where an answer goes, from the state of its item; see answerLoop. */
function routeAnswer(
  loop: LoopState,
  state: LoopItemState | undefined,
  question: LoopQuestion | undefined,
  input: LoopAnswerInput,
): { route: LoopAnswerRoute; itemChange?: Partial<LoopItemState> } {
  if (!state) return { route: input.standing ? "standing" : "replan" };
  const confirmsAssumption = !!input.confirm && question?.kind === "assumption";
  switch (state.status) {
    case "waiting":
    case "failed": {
      // Still waiting on another blocking question: one answer is not enough.
      const others = openQuestions(loop, state.id).filter(
        (q) =>
          q.id !== question?.id &&
          (q.kind === "blocking" || q.kind === "approval"),
      );
      if (state.status === "waiting" && others.length > 0) {
        return { route: "next-run" };
      }
      return {
        route: "requeue",
        itemChange: { status: "pending", attempts: 0 },
      };
    }
    case "pending":
    case "redo":
      // A confirmed assumption needs no delivery.
      return { route: confirmsAssumption ? "confirmed" : "next-run" };
    case "running":
      return { route: confirmsAssumption ? "confirmed" : "steer" };
    case "done":
      if (confirmsAssumption) return { route: "confirmed" };
      if (question?.kind === "approval" && !input.approve) {
        return { route: "confirmed" };
      }
      return { route: "redo", itemChange: { status: "redo", attempts: 0 } };
  }
}

export function answerLoop(
  loop: LoopState,
  input: LoopAnswerInput,
  now: Date,
): AnswerResult {
  const question = input.questionId
    ? loop.questions.find((q) => q.id === input.questionId)
    : undefined;
  if (input.questionId && !question) {
    return { ok: false, error: `No question ${input.questionId}` };
  }
  if (question?.answerId) {
    return { ok: false, error: `${question.id} is already answered` };
  }
  const text = answerText(question, input);
  if (!text) return { ok: false, error: "The answer is empty" };
  if (text.length > LOOP_LIMITS.maxAnswerLength) {
    return {
      ok: false,
      error: `The answer is longer than ${LOOP_LIMITS.maxAnswerLength} characters`,
    };
  }

  const itemId = question?.itemId ?? input.itemId;
  const state = itemId ? itemState(loop, itemId) : undefined;
  if (itemId && !state) {
    return { ok: false, error: `No item ${itemId} in the loop` };
  }
  const { route, itemChange } = routeAnswer(loop, state, question, input);

  const answer: LoopAnswer = {
    id: nextId("a", loop.answers),
    ...(question ? { questionId: question.id } : {}),
    ...(itemId ? { itemId } : {}),
    text,
    ...(input.replanNow && route === "replan" ? { replanNow: true } : {}),
    ...(input.approve === undefined ? {} : { approve: input.approve }),
    route,
    givenAt: iso(now),
    ...(route === "confirmed" ? { delivered: true } : {}),
  };

  let next: LoopState = {
    ...loop,
    answers: [...loop.answers, answer],
    questions: loop.questions.map((q) =>
      q.id === question?.id ? { ...q, answerId: answer.id } : q,
    ),
  };
  if (itemId && itemChange) next = withItem(next, itemId, itemChange);
  if (question?.kind === "approval" && input.approve && question.approval) {
    next = {
      ...next,
      grants: [...new Set([...next.grants, question.approval.grantKey])],
    };
  }
  if (answer.replanNow) next = { ...next, replanRequested: true };
  // An answer to a loop that waited on the person resumes it.
  if (
    next.status === "waiting" &&
    route !== "confirmed" &&
    route !== "standing"
  ) {
    next = { ...next, status: "running", waitingSince: undefined };
  }
  return { ok: true, loop: next, answer };
}

/**
 * After a run ended: an item that reported waiting must have something to wait
 * for, or nothing would ever wake it. If nothing blocking is open and answers
 * came in during the run, it runs again with them. If it never asked anything,
 * it has failed: the person has nothing to answer.
 */
export function releaseEmptyWait(loop: LoopState, itemId: string): LoopState {
  if (itemState(loop, itemId)?.status !== "waiting") return loop;
  if (hasOpenBlocking(loop, itemId)) return loop;
  if (answersToDeliver(loop, itemId).length > 0) {
    return withItem(loop, itemId, { status: "pending", attempts: 0 });
  }
  return {
    ...withItem(loop, itemId, {
      status: "failed",
      summary: "Reported waiting, but no question is open.",
    }),
    consecutiveFailures: (loop.consecutiveFailures ?? 0) + 1,
  };
}

/** The person's standing instructions, for every item prompt. */
export function standingInstructions(loop: LoopState): string[] {
  return loop.answers.filter((a) => a.route === "standing").map((a) => a.text);
}

/** Answers for an item that its next run's prompt should carry. */
export function answersToDeliver(
  loop: LoopState,
  itemId: string,
): LoopAnswer[] {
  return loop.answers.filter(
    (a) =>
      a.itemId === itemId &&
      !a.delivered &&
      (a.route === "requeue" ||
        a.route === "next-run" ||
        a.route === "redo" ||
        a.route === "steer"),
  );
}

export function markDelivered(loop: LoopState, ids: string[]): LoopState {
  if (ids.length === 0) return loop;
  return {
    ...loop,
    answers: loop.answers.map((a) =>
      ids.includes(a.id) ? { ...a, delivered: true } : a,
    ),
  };
}

/** Uses a grant for an exact tool call, if the person allowed one. */
export function consumeLoopGrant(
  loop: LoopState,
  grantKey: string,
): { loop: LoopState; granted: boolean } {
  if (!loop.grants.includes(grantKey)) return { loop, granted: false };
  return {
    loop: { ...loop, grants: loop.grants.filter((g) => g !== grantKey) },
    granted: true,
  };
}

/** The task list as the loop sees it: statuses and notes follow the loop. */
export function taskPlanWithLoop(plan: TaskPlan, loop: LoopState): TaskPlan {
  let changed = false;
  const items = plan.items.map((task): TaskItem => {
    const state = itemState(loop, task.id);
    if (!state) return task;
    const open = openQuestions(loop, task.id);
    let status: TaskItem["status"] = task.status;
    let note: string | undefined = task.note;
    switch (state.status) {
      case "running":
        status = "in_progress";
        note = undefined;
        break;
      case "done":
        status = task.status === "cancelled" ? "cancelled" : "completed";
        note = state.summary;
        break;
      case "waiting":
        status = "blocked";
        note = `Waiting on you: ${open.map((q) => q.id).join(", ") || "an answer"}`;
        break;
      case "failed":
        status = "blocked";
        note = `Failed: ${state.summary ?? "no report"}`;
        break;
      case "redo":
        status = "pending";
        note = "Redo: an assumption was overruled";
        break;
      case "pending":
        status = "pending";
        note = undefined;
        break;
    }
    note = note?.slice(0, 200);
    if (status === task.status && note === task.note) return task;
    changed = true;
    const { note: _old, ...rest } = task;
    return { ...rest, status, ...(note ? { note } : {}) };
  });
  return changed ? { ...plan, items } : plan;
}

/** True when `next` has a to-do whose text is not among `previousTexts`. */
export function planAddsScope(
  previousTexts: string[],
  next: TaskPlan,
): boolean {
  const known = new Set(previousTexts);
  return next.items.some((i) => !known.has(i.text));
}

/**
 * The run ended. Steered answers in `deliveredIds` reached it at a tool
 * boundary. The others came too late: they go with the item's next run, and
 * an item that finished anyway is reopened as redo.
 */
export function settleSteeredAnswers(
  loop: LoopState,
  deliveredIds: string[],
): LoopState {
  let next = loop;
  for (const answer of loop.answers) {
    if (answer.route !== "steer" || answer.delivered) continue;
    if (deliveredIds.includes(answer.id)) {
      next = markDelivered(next, [answer.id]);
      continue;
    }
    const item = answer.itemId ? itemState(next, answer.itemId) : undefined;
    const redo = item?.status === "done";
    next = {
      ...next,
      answers: next.answers.map((a) =>
        a.id === answer.id
          ? { ...a, route: redo ? ("redo" as const) : ("next-run" as const) }
          : a,
      ),
    };
    if (redo && item) {
      next = withItem(next, item.id, { status: "redo", attempts: 0 });
    }
  }
  return next;
}

/**
 * A re-plan was accepted: the new list is the next round. Items that kept
 * their id keep their state (finished work stays done); new ones are pending;
 * failed ones that the plan kept run again.
 */
export function acceptReplan(
  loop: LoopState,
  plan: TaskPlan,
  ctx: LoopContext,
): LoopState {
  const items = plan.items.map((task) => {
    const known = itemState(loop, task.id);
    if (!known) return fromTask(task);
    if (known.status === "failed") {
      return { ...known, status: "pending" as const, attempts: 0 };
    }
    return known;
  });
  const noProgressRounds =
    loop.doneThisRound === 0 ? loop.noProgressRounds + 1 : 0;
  return {
    ...loop,
    status: "running",
    current: undefined,
    round: loop.round + 1,
    items,
    doneThisRound: 0,
    noProgressRounds,
  };
}

function quote(text: string): string {
  return text.replace(/\s*\n\s*/g, " ");
}

/**
 * The prompt for one item's run: the item, where the plan is, the answers it
 * should use, and the contract. It never explains the loop or asks the model
 * to choose what comes next.
 */
export function loopItemPrompt(input: {
  item: TaskItem;
  planFile?: string;
  answers: LoopAnswer[];
  questions: LoopQuestion[];
  redo?: boolean;
  attempt: number;
  /** What earlier runs learned (LoopState.notes) */
  notes?: string[];
  /** The person's instructions for every item (standingInstructions) */
  standing?: string[];
  /** The run starts without the conversation before it */
  freshContext?: boolean;
  /** Questions of this item nobody answered in time (unattended) */
  unanswered?: LoopQuestion[];
}): string {
  const { item } = input;
  const lines = [
    `Work on this item of the plan, and only this item: ${quote(item.text)}`,
  ];
  if (input.planFile) {
    lines.push(
      `The plan is in ${input.planFile}; read it for context. Other items are handled separately${input.freshContext ? ", and their work is in the files, not in this conversation" : ""}.`,
    );
  }
  if (input.redo) {
    lines.push(
      "This item was finished before on an assumption the person has now overruled. Redo it to match their answer below.",
    );
  } else if (input.attempt > 1) {
    lines.push(
      "An earlier run of this item ended without reporting. Check what is already done before you change anything.",
    );
  }
  if (input.unanswered?.length) {
    lines.push(
      "",
      "Nobody answered these questions in time, so go on without the answers:",
    );
    for (const q of input.unanswered) lines.push(`- ${quote(q.question)}`);
    lines.push(
      `For each, take your best default and record it with ${HOLD_QUESTION_TOOL_NAME} kind "assumption". Do not do anything that cannot be undone on such a default; leave that part and say so in the summary.`,
    );
  }
  if (input.standing?.length) {
    lines.push("", "The person's instructions for every item:");
    for (const s of input.standing) lines.push(`- ${quote(s)}`);
  }
  if (input.notes?.length) {
    lines.push("", "Notes from earlier items:");
    for (const n of input.notes) lines.push(`- ${quote(n)}`);
  }
  if (input.answers.length > 0) {
    lines.push("", "The person's answers:");
    for (const answer of input.answers) {
      const q = input.questions.find((x) => x.id === answer.questionId);
      lines.push(
        q
          ? `- To "${quote(q.question)}": ${quote(answer.text)}`
          : `- ${quote(answer.text)}`,
      );
    }
  }
  lines.push(
    "",
    "Search the code before you add anything: do not assume something is missing because one search did not find it. Implement the item fully, with no placeholders or stubs.",
    "",
    "Before you report it done, run the checks the project has for what you changed (tests, type check, lint) and fix what fails; name them in your summary, or say there was nothing to run.",
    "",
    `When the item is done, call ${FINISH_ITEM_TOOL_NAME} with outcome "done" and a one-line summary. If you cannot finish it, call ${FINISH_ITEM_TOOL_NAME} with outcome "stuck" and say why. Put anything a later item should know (a command that works, a trap you hit) in \`notes\`: one or two lines, not progress.`,
    "",
    `Ask, rather than decide silently: whenever the person might want a say (a choice between approaches, scope, naming, an irreversible step, or anything the plan does not settle), call ${HOLD_QUESTION_TOOL_NAME}. Use kind "assumption" by default: state the choice you are making in \`assumption\` and keep working; the person can overrule it later. Use kind "blocking" only when there is no reasonable default, then stop and call ${FINISH_ITEM_TOOL_NAME} with outcome "waiting". Write each question so it can be answered without this conversation: name the item, the options and your default.`,
  );
  return lines.join("\n");
}

const STATUS_MARK: Record<LoopItemStatus, string> = {
  pending: "[ ]",
  redo: "[ ]",
  running: "[>]",
  done: "[x]",
  waiting: "[?]",
  failed: "[!]",
};

/** The prompt for a re-plan turn (sent in Plan mode, so it can only read). */
export function loopReplanPrompt(input: {
  loop: LoopState;
  plan: TaskPlan;
  planFile?: string;
  planTitle?: string;
}): string {
  const { loop, plan } = input;
  const lines = [
    `No item of the plan can run now. Re-evaluate the plan${input.planFile ? ` in ${input.planFile}` : ""} against what has happened, and propose the next round.`,
    "",
    "Items:",
  ];
  for (const task of plan.items) {
    const state = itemState(loop, task.id);
    const status = state?.status ?? "pending";
    const detail =
      status === "waiting"
        ? `waiting on: ${openQuestions(loop, task.id)
            .map((q) => quote(q.question))
            .join("; ")}`
        : state?.summary
          ? quote(state.summary)
          : "";
    lines.push(
      `- ${STATUS_MARK[status]} ${quote(task.text)} (${status}${detail ? `: ${detail}` : ""})`,
    );
  }
  const planAnswers = loop.answers.filter(
    (a) => a.route === "replan" && !a.delivered,
  );
  const assumptions = loop.questions.filter(
    (q) => q.kind === "assumption" && !q.answerId,
  );
  if (loop.notes?.length) {
    lines.push("", "Notes from the runs:");
    for (const n of loop.notes) lines.push(`- ${quote(n)}`);
  }
  if (planAnswers.length > 0) {
    lines.push("", "What the person said about the plan:");
    for (const a of planAnswers) lines.push(`- ${quote(a.text)}`);
  }
  if (assumptions.length > 0) {
    lines.push("", "Assumptions made and not yet confirmed:");
    for (const q of assumptions) {
      lines.push(
        `- ${quote(q.question)} Assumed: ${quote(q.assumption ?? "")}`,
      );
    }
  }
  lines.push(
    "",
    "The plan may be wrong. Check its open items against the code before you keep them: drop what is already done, and do not add what already exists.",
    "",
    `Read what you need, then call present_plan${input.planTitle ? ` with the title "${quote(input.planTitle)}"` : ""} with the updated to-dos. Keep finished to-dos word for word so they stay done. Reword or split items that failed, drop what is no longer needed, and add only work the plan's goal requires. Leave items that wait on the person in the list as they are.`,
  );
  return lines.join("\n");
}

/** One line for the loop's state, for the inbox header and the CLI. */
export function formatLoopStatus(
  loop: LoopState,
  options: { level?: boolean } = {},
): string {
  const done = loop.items.filter((i) => i.status === "done").length;
  const waiting = loop.items.filter((i) => i.status === "waiting").length;
  const open = loop.questions.filter((q) => !q.answerId).length;
  const parts = [
    ...(options.level === false ? [] : [loopAutonomy(loop).label]),
    `Round ${loop.round}`,
    `${done}/${loop.items.length} done`,
  ];
  if (waiting) parts.push(`${waiting} waiting on you`);
  if (open) parts.push(`${open} open question${open === 1 ? "" : "s"}`);
  if (loop.stopRequested) parts.push("stopping after this step");
  switch (loop.status) {
    case "replanning":
      parts.push("re-planning");
      break;
    case "awaiting_plan":
      parts.push("new plan to accept");
      break;
    case "waiting": {
      const wait = loopAutonomy(loop).waitTimeoutMs;
      if (wait > 0 && loop.waitingSince) {
        const at = new Date(new Date(loop.waitingSince).getTime() + wait);
        parts.push(
          `goes on without answers at ${at.toTimeString().slice(0, 5)}`,
        );
      } else {
        parts.push("paused until you answer");
      }
      break;
    }
    case "stopped":
      parts.push(`stopped: ${loop.stopDetail ?? loop.stopReason}`);
      break;
  }
  return parts.join(" · ");
}

export function isLoopState(value: unknown): value is LoopState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LoopState>;
  return (
    typeof v.status === "string" &&
    typeof v.round === "number" &&
    Array.isArray(v.items) &&
    Array.isArray(v.questions) &&
    Array.isArray(v.answers) &&
    typeof v.budget === "object"
  );
}

/**
 * A loop restored from a saved session. A run that was going when the window
 * closed did not finish: its item goes back to pending (its next run checks
 * what is already done) and the loop is stopped, so a reload never starts
 * work by itself.
 */
export function restoreLoop(value: unknown): LoopState | undefined {
  if (!isLoopState(value)) return undefined;
  if (!value.current && value.status !== "replanning") return value;
  return stopLoop(
    {
      ...value,
      status: value.status === "replanning" ? "running" : value.status,
    },
    "stopped",
    "The window reloaded while the loop was running. Resume to go on.",
  );
}

/** Text of the tool result for finish_item. */
export function finishItemResult(outcome: FinishOutcome): string {
  switch (outcome) {
    case "done":
      return "Recorded as done. End your turn now.";
    case "waiting":
      return "Recorded as waiting on the person. End your turn now.";
    case "stuck":
      return "Recorded as stuck. End your turn now.";
  }
}

/** Text of the tool result for hold_question. */
export function holdQuestionResult(
  question: LoopQuestion,
  duplicate: boolean,
): string {
  const prefix = duplicate
    ? `You already asked this (${question.id}).`
    : `Question ${question.id} is in the person's inbox.`;
  return question.kind === "assumption"
    ? `${prefix} Keep working on your assumption; if they overrule it, the item will be redone.`
    : `${prefix} Do what you can without the answer, then call ${FINISH_ITEM_TOOL_NAME} with outcome "waiting".`;
}

/** What the model sees when a tool call that would ask is held as a question. */
export function approvalHeldResult(question: LoopQuestion): string {
  return `This call needs the person's approval, so it was not run. It is held as question ${question.id} in their inbox. Do not try to reach the same result another way. Do what you can without it, then call ${FINISH_ITEM_TOOL_NAME} with outcome "waiting"; the item will run again once they answer.`;
}
