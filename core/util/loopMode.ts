import type {
  LoopAnswer,
  LoopAnswerRoute,
  LoopAutonomy,
  LoopBudget,
  LoopCheckResult,
  LoopItemState,
  LoopItemStatus,
  LoopQuestion,
  LoopQuestionKind,
  LoopState,
  LoopStopReason,
  LoopStrategy,
  MessageContent,
  TaskItem,
  TaskPlan,
} from "../index.js";
import { stableStringify } from "../tools/permissions/auto/state.js";
import {
  hasReplanReminder,
  LOOP_REMINDER_LIMITS,
  rehomedReminders,
  releasedReminders,
  reminderFilePaths,
  type LoopDeliveredReminder,
} from "./loopReminders.js";
import { TASK_LIST_BLOCK_CLOSE, TASK_LIST_BLOCK_OPEN } from "./taskPlan.js";

/**
 * Loop mode: build a plan item by item without the person driving each step.
 * The extension, not the model, runs the loop: it picks the next item that is
 * not waiting, runs it with a short one-item prompt, records questions the
 * model holds for the person, routes the person's answers by the state of the
 * item they are about, and re-plans in a read-only Plan-mode turn when no
 * item is left to run. The loop's strategy (LOOP_STRATEGIES) adds re-plans
 * of its own: check-ins between items, or a repair of one failed item.
 * Everything here is pure; the gui and the CLI apply the results. Design:
 * plans/loop-mode.md.
 */

export const HOLD_QUESTION_TOOL_NAME = "hold_question";
export const FINISH_ITEM_TOOL_NAME = "finish_item";
export const REMIND_ME_TOOL_NAME = "remind_me";

/**
 * The names the prompts and tool results give the model for the loop's
 * tools and the plan tool. The IDE's tools are snake_case; the CLI's are
 * PascalCase like its other tools (LOOP_CLI_TOOL_NAMES).
 */
export interface LoopToolNames {
  holdQuestion: string;
  finishItem: string;
  remindMe: string;
  presentPlan: string;
}

export const LOOP_TOOL_NAMES: LoopToolNames = {
  holdQuestion: HOLD_QUESTION_TOOL_NAME,
  finishItem: FINISH_ITEM_TOOL_NAME,
  remindMe: REMIND_ME_TOOL_NAME,
  presentPlan: "present_plan",
};

export const LOOP_CLI_TOOL_NAMES: LoopToolNames = {
  holdQuestion: "HoldQuestion",
  finishItem: "FinishItem",
  remindMe: "RemindMe",
  presentPlan: "PresentPlan",
};

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
  idgaf: {
    label: "IDGAF",
    description:
      "The agent answers every question itself, even important decisions, and never waits for you. Re-plans that add up to 5 to-dos go on by themselves.",
    replan: "bounded",
    maxNewItemsPerReplan: 5,
    // Approvals are the approval mode's business (YOLO runs them all). One
    // that is held anyway must not stop the loop.
    waitTimeoutMs: 1000,
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
  "idgaf",
];

/** The level a loop starts at, from the approval mode in force. */
export function loopAutonomyFor(
  approvalMode:
    "manual" | "autoApprove" | "auto" | "review" | "yolo" | undefined,
): LoopAutonomy {
  switch (approvalMode) {
    case "review":
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

/**
 * Changes the level of a running loop; the budgets become that level's. The
 * strategy follows the level (defaultLoopStrategy) unless the person picked
 * one, so a pick is never overridden. A loop saved before strategies keeps
 * "finish", as it had no default to follow.
 */
export function setLoopAutonomy(
  loop: LoopState,
  autonomy: LoopAutonomy,
): LoopState {
  const changed = {
    ...loop,
    autonomy,
    budget: { ...LOOP_AUTONOMY[autonomy].budget },
  };
  if (!loop.strategy || loop.strategyPicked) return changed;
  return withStrategy(changed, defaultLoopStrategy(autonomy));
}

export interface LoopStrategyPreset {
  label: string;
  /** One line for the picker */
  description: string;
}

/** Items finished between two check-ins (check-in strategy). */
export const LOOP_CHECK_IN_EVERY = 3;

/** Re-plans scoped to one failed item before it stays failed (fix forward). */
export const LOOP_MAX_REPAIRS_PER_ITEM = 2;

/** To-dos a repair may split a failed item into and still go on by itself. */
export const LOOP_REPAIR_MAX_TODOS = 3;

/**
 * How the loop moves through the plan: the second setting next to the
 * autonomy level. Whatever the strategy, the person's rules, held approvals,
 * the repeat limit, the budgets (rounds, tokens, time), the no-progress stop
 * and the three-failures stop all hold. Design: plans/loop-mode.md,
 * "Strategies".
 */
export const LOOP_STRATEGIES: Record<LoopStrategy, LoopStrategyPreset> = {
  finish: {
    label: "Finish what you started",
    description:
      "Items in plan order; a failed item runs again once, and the plan is re-evaluated only when nothing can run.",
  },
  "check-in": {
    label: "Check in",
    description: `Items in plan order; the plan is also re-evaluated after every ${LOOP_CHECK_IN_EVERY} finished items, and at once when an item fails or an assumption is overruled.`,
  },
  "fix-forward": {
    label: "Fix forward",
    description: `A failed item gets a re-plan of just that item (reworded, split or dropped), at most ${LOOP_MAX_REPAIRS_PER_ITEM} times, then the loop moves on.`,
  },
};

export const LOOP_STRATEGY_ORDER: readonly LoopStrategy[] = [
  "finish",
  "check-in",
  "fix-forward",
];

/** The strategy a level starts with: Supervised finishes, the others fix forward. */
export function defaultLoopStrategy(autonomy: LoopAutonomy): LoopStrategy {
  return autonomy === "supervised" ? "finish" : "fix-forward";
}

/** The loop's strategy; a loop saved before strategies finishes what it started. */
export function loopStrategy(loop: LoopState): LoopStrategy {
  return loop.strategy ?? "finish";
}

/** Switches strategy, dropping what the old one had pending. */
function withStrategy(loop: LoopState, strategy: LoopStrategy): LoopState {
  if (strategy === loopStrategy(loop)) return { ...loop, strategy };
  return {
    ...loop,
    strategy,
    checkInDue: undefined,
    repairItemId: undefined,
    doneSinceReplan: strategy === "check-in" ? 0 : undefined,
  };
}

/** The person picked a strategy: it stays when the level changes. */
export function setLoopStrategy(
  loop: LoopState,
  strategy: LoopStrategy,
): LoopState {
  return { ...withStrategy(loop, strategy), strategyPicked: true };
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
  /** The tail of a check's output that is kept and shown */
  maxCheckOutput: 2000,
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
export function repeatedCallResult(
  toolName: string,
  count: number,
  names: LoopToolNames = LOOP_TOOL_NAMES,
): string {
  return `${toolName} was not run: the same call has run ${count - 1} times with no file change in between, and its last result is above. A different check of your current explanation would return new information. If nothing is left to check, call ${names.finishItem} with outcome "stuck" and say what is in the way, or, if another item may settle this, with outcome "later".`;
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
  return `You have made ${turns} requests on this item, so this call was not run. Stop reading and searching. Write what the item needs now, in as few calls as you can, then call ${FINISH_ITEM_TOOL_NAME}: outcome "done" if the item is finished, otherwise "stuck" and say what is left, or "later" if another item may settle this.`;
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
export function replanHoldResult(names: LoopToolNames = LOOP_TOOL_NAMES) {
  return `Re-planning only reads, so this call was not run. Present the plan with ${names.presentPlan} instead.`;
}

export const REPLAN_HOLD_RESULT = replanHoldResult();

export type FinishOutcome = "done" | "stuck" | "waiting" | "later";

/**
 * Times one item may be set aside with outcome "later"; one more is recorded
 * as stuck, because "later" is an easy way out of hard work.
 */
export const LOOP_MAX_DEFERRALS = 1;

/** The item has used its deferrals, so another "later" counts as stuck. */
export function deferralSpent(loop: LoopState, itemId: string): boolean {
  return (itemState(loop, itemId)?.deferrals ?? 0) >= LOOP_MAX_DEFERRALS;
}

/** What the loop should do next; see decideNext. */
export type LoopAction =
  | { kind: "run"; itemId: string }
  /** Run an item's check (TaskItem.check): the harness runs the command */
  | { kind: "check"; itemId: string; command: string }
  /**
   * A re-plan turn. checkIn: a check-in between items (check-in strategy),
   * with why it is due. itemId: a repair of that failed item only (fix
   * forward). Neither: the round's re-plan, as before strategies.
   */
  | { kind: "replan"; checkIn?: string; itemId?: string }
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

/**
 * The items `task` comes after (TaskItem.after) that are not done yet. A
 * skipped item does not count as done; one gone from the plan is ignored.
 */
export function unmetDependencies(
  loop: LoopState,
  plan: TaskPlan,
  task: TaskItem,
): string[] {
  return (task.after ?? []).filter((id) => {
    if (!plan.items.some((t) => t.id === id)) return false;
    const state = itemState(loop, id);
    return !(state?.status === "done" && !state.skipped);
  });
}

/** Unmet dependencies that will not finish by themselves: failed or skipped. */
export function blockingDependencies(
  loop: LoopState,
  plan: TaskPlan,
  task: TaskItem,
): string[] {
  return unmetDependencies(loop, plan, task).filter((id) => {
    const state = itemState(loop, id);
    return state?.status === "failed" || !!state?.skipped;
  });
}

/**
 * The item cannot go on until the person answers: it waits, its check waits
 * for an approval, or everything it comes after waits on the person.
 */
function waitsOnPerson(
  loop: LoopState,
  plan: TaskPlan,
  state: LoopItemState,
  memo: Map<string, boolean> = new Map(),
): boolean {
  const known = memo.get(state.id);
  if (known !== undefined) return known;
  // While it is being worked out, a circle counts as not waiting
  memo.set(state.id, false);
  let result = false;
  if (state.status === "waiting") {
    result = true;
  } else if (state.status === "checking") {
    result = hasOpenBlocking(loop, state.id);
  } else if (state.status === "pending" || state.status === "redo") {
    const task = plan.items.find((t) => t.id === state.id);
    const unmet = task ? unmetDependencies(loop, plan, task) : [];
    result =
      unmet.length > 0 &&
      unmet.every((id) => {
        const dep = itemState(loop, id);
        return !!dep && waitsOnPerson(loop, plan, dep, memo);
      });
  }
  memo.set(state.id, result);
  return result;
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
    /**
     * Given: the person's pick. Otherwise the level's default
     * (defaultLoopStrategy), or "finish" when no level is named either.
     */
    strategy?: LoopStrategy;
  },
): LoopState {
  const strategy =
    options.strategy ??
    (options.autonomy ? defaultLoopStrategy(options.autonomy) : undefined);
  return {
    ...(strategy ? { strategy } : {}),
    ...(options.strategy ? { strategyPicked: true } : {}),
    ...(strategy === "check-in" ? { doneSinceReplan: 0 } : {}),
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
    if (known.status === "checking" && !task.check) {
      return { ...known, status: "done" as const };
    }
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

/**
 * The first item, in plan order, that can run now. An item set aside with
 * finish_item outcome "later" goes behind the others, in plan order among
 * themselves, and runs when only such items are left.
 */
export function nextRunnableItem(
  loop: LoopState,
  plan: TaskPlan,
): TaskItem | undefined {
  const runnable = plan.items.filter((task) => {
    const state = itemState(loop, task.id);
    return (
      state !== undefined &&
      OPEN_STATUSES.includes(state.status) &&
      unmetDependencies(loop, plan, task).length === 0
    );
  });
  return (
    runnable.find((task) => !itemState(loop, task.id)?.setAside) ?? runnable[0]
  );
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
 * that asked to re-plan now; the strategy's own re-plan (strategyReplan:
 * none for "finish"); the next runnable item; done when every item is
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
  // An item that reported done has its check run before anything else
  const checking = plan.items.find((task) => {
    const state = itemState(loop, task.id);
    return state?.status === "checking" && !hasOpenBlocking(loop, task.id);
  });
  if (checking?.check) {
    return { kind: "check", itemId: checking.id, command: checking.check };
  }
  if (loop.replanRequested) {
    return replanOrStop(loop);
  }
  const strategic = strategyReplan(loop, plan);
  if (strategic) return strategic;
  const next = nextRunnableItem(loop, plan);
  if (next) {
    return { kind: "run", itemId: next.id };
  }
  if (live.every((i) => i.status === "done")) {
    if (hasUndeliveredPlanAnswers(loop) || hasReplanReminder(loop)) {
      return replanOrStop(loop);
    }
    const skipped = live.filter((i) => i.skipped).length;
    return {
      kind: "stop",
      reason: "done",
      detail: `All ${live.length} items are done${skipped ? ` (${skipped} skipped)` : ""}.`,
    };
  }
  const open = live.filter((i) => i.status !== "done");
  if (open.every((i) => waitsOnPerson(loop, plan, i))) {
    const { waitTimeoutMs } = loopAutonomy(loop);
    if (waitTimeoutMs <= 0) return { kind: "wait" };
    const since = new Date(loop.waitingSince ?? ctx.now).getTime();
    if (ctx.now.getTime() - since >= waitTimeoutMs) return { kind: "proceed" };
    return { kind: "wait", until: iso(new Date(since + waitTimeoutMs)) };
  }
  return replanOrStop(loop);
}

/**
 * The re-plans a strategy adds before the next item runs; undefined leaves
 * the decision to decideNext as before strategies (so "finish" adds none).
 * They come after the budgets and the failures stop, and only when a round's
 * re-plan would be allowed now (the rounds and no-progress limits): a
 * strategy's re-plan never stops the loop; when the limits forbid it, the
 * items simply go on.
 *
 * - check-in: with an item left to run, a check-in when an event asked for
 *   one (an item failed, an assumption was overruled) or LOOP_CHECK_IN_EVERY
 *   items were done since the last re-plan.
 * - fix-forward: a repair of the item that just failed, if it is still
 *   failed and in the plan (an answer may have requeued it meanwhile).
 */
function strategyReplan(
  loop: LoopState,
  plan: TaskPlan,
): LoopAction | undefined {
  switch (loopStrategy(loop)) {
    case "finish":
      return undefined;
    case "check-in": {
      if (!nextRunnableItem(loop, plan)) return undefined;
      const done = loop.doneSinceReplan ?? 0;
      const reason =
        loop.checkInDue ??
        (done >= LOOP_CHECK_IN_EVERY
          ? `${done} items were done since the last check-in.`
          : undefined);
      if (!reason || replanOrStop(loop).kind !== "replan") return undefined;
      return { kind: "replan", checkIn: reason };
    }
    case "fix-forward": {
      const id = loop.repairItemId;
      if (
        !id ||
        itemState(loop, id)?.status !== "failed" ||
        !plan.items.some((t) => t.id === id) ||
        replanOrStop(loop).kind !== "replan"
      ) {
        return undefined;
      }
      return { kind: "replan", itemId: id };
    }
  }
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
    ...releasedReminders(loop),
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

function todos(n: number): string {
  return `${n} to-do${n === 1 ? "" : "s"}`;
}

/**
 * What a re-plan did that nobody should find out about only afterwards: it
 * changed or removed a check that had failed, which is an easy way to make an
 * item pass, or it dropped an item that was finished. Undefined if neither.
 * A model did both in a sandbox run and the loop then reported all items done.
 */
export function replanConcern(
  loop: LoopState,
  plan: TaskPlan,
): string | undefined {
  const task = (id: string) => plan.items.find((t) => t.id === id);
  const failedCheck = loop.items.filter(
    (i) =>
      i.check?.status === "failed" && task(i.id)?.check !== i.check.command,
  );
  const droppedDone = loop.items.filter(
    (i) => i.status === "done" && !i.skipped && !task(i.id),
  );
  const parts = [
    failedCheck.length
      ? `It changes or removes the failing check of ${failedCheck.length === 1 ? "item" : "items"} ${failedCheck.map((i) => i.id).join(", ")}.`
      : "",
    droppedDone.length
      ? `It drops finished ${droppedDone.length === 1 ? "item" : "items"} ${droppedDone.map((i) => i.id).join(", ")}.`
      : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * A repair re-plan (fix forward) ended with a plan: may the loop go on with
 * it by itself? Supervised: never, as for any re-plan. Auto and Unattended:
 * when it touched only the failed item (every other to-do kept word for
 * word) and replaced it with at most LOOP_REPAIR_MAX_TODOS to-dos, which
 * includes rewording it (one new to-do) and dropping it (none). A repair that
 * changed more is judged as a round's re-plan (replanDecision).
 */
export function repairDecision(
  loop: LoopState,
  previousTexts: string[],
  itemText: string,
  plan: TaskPlan,
): { accept: boolean; reason: string } {
  if (loopAutonomy(loop).replan === "ask") {
    return replanDecision(loop, previousTexts, plan);
  }
  const texts = new Set(plan.items.map((i) => i.text));
  const othersKept = previousTexts
    .filter((t) => t !== itemText)
    .every((t) => texts.has(t));
  const known = new Set(previousTexts);
  const added = plan.items.filter((i) => !known.has(i.text)).length;
  if (!othersKept || added > LOOP_REPAIR_MAX_TODOS) {
    return replanDecision(loop, previousTexts, plan);
  }
  if (added > 0) {
    return {
      accept: true,
      reason: texts.has(itemText)
        ? `The repair keeps the failed item and adds ${todos(added)} for it.`
        : `The repair replaces the failed item with ${todos(added)}.`,
    };
  }
  return {
    accept: true,
    reason: texts.has(itemText)
      ? "The repair keeps the failed item as it was."
      : "The repair drops the failed item.",
  };
}

/**
 * A re-plan turn ended and presented `plan`: the loop waits on it
 * (awaiting_plan), remembering what the re-plan was for, and `accept` says
 * whether it may start by itself (then call acceptReplan).
 */
export function endReplan(
  loop: LoopState,
  plan: TaskPlan | undefined,
): { loop: LoopState; accept: boolean } {
  const current = loop.current;
  const planTexts = current?.planTexts ?? [];
  const repairOf =
    current?.kind === "replan" && current.itemId
      ? { itemId: current.itemId, itemText: current.itemText ?? "" }
      : undefined;
  const decision = !plan
    ? { accept: false, reason: "The re-plan left no to-dos." }
    : repairOf
      ? repairDecision(loop, planTexts, repairOf.itemText, plan)
      : replanDecision(loop, planTexts, plan);
  const concern = plan ? replanConcern(loop, plan) : undefined;
  const reason = concern ? `${concern} ${decision.reason}` : decision.reason;
  return {
    loop: {
      ...loop,
      current: undefined,
      status: "awaiting_plan",
      replanReason: reason,
      replanned: {
        planTexts,
        ...(current?.checkIn ? { checkIn: current.checkIn } : {}),
        ...repairOf,
      },
    },
    accept: decision.accept && !concern,
  };
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
      setAside: undefined,
    }),
    status: "running",
    current: { kind: "item", itemId, historyIndex, startedAt: iso(now) },
  };
}

/**
 * The harness starts an item's check (decideNext's "check" action). It is not
 * a model turn; `current` marks it so a held approval names the item.
 */
export function startCheck(
  loop: LoopState,
  itemId: string,
  historyIndex: number,
  now: Date,
): LoopState {
  return {
    ...loop,
    status: "running",
    current: { kind: "check", itemId, historyIndex, startedAt: iso(now) },
  };
}

/**
 * The check ran, or could not. passed (exit 0): the item is done. failed:
 * the item runs again with the output, up to maxAttempts, then is failed.
 * refused (a rule refused the command, or the person did not allow it): the
 * item is done without its check.
 */
export function recordCheck(
  loop: LoopState,
  result: {
    status: LoopCheckResult["status"];
    command: string;
    exitCode?: number | null;
    output?: string;
  },
  now: Date,
): LoopState {
  const itemId =
    loop.current?.kind === "check" ? loop.current.itemId : undefined;
  if (!itemId) return loop;
  const state = itemState(loop, itemId);
  const check: LoopCheckResult = {
    status: result.status,
    command: result.command,
    ...(result.exitCode !== undefined ? { exitCode: result.exitCode } : {}),
    ...(result.output
      ? { output: result.output.slice(-LOOP_LIMITS.maxCheckOutput) }
      : {}),
    at: iso(now),
  };
  let status: LoopItemStatus;
  let summary = state?.summary;
  if (result.status === "failed") {
    status =
      (state?.attempts ?? 0) >= loop.budget.maxAttempts ? "failed" : "pending";
    summary = `The check failed${typeof result.exitCode === "number" ? ` (exit ${result.exitCode})` : ""}: ${result.command}`;
  } else {
    status = "done";
  }
  const failures =
    status === "failed"
      ? (loop.consecutiveFailures ?? 0) + 1
      : status === "done"
        ? 0
        : (loop.consecutiveFailures ?? 0);
  return {
    ...withItem(loop, itemId, { status, check, summary }),
    current: undefined,
    doneThisRound: loop.doneThisRound + (status === "done" ? 1 : 0),
    consecutiveFailures: failures,
    ...strategyAfterRun(loop, state, status),
  };
}

/**
 * The check would ask for approval and is held as a question (the caller
 * held it while `current` named the item): the item stays checking.
 */
export function holdCheck(loop: LoopState): LoopState {
  return loop.current?.kind === "check"
    ? { ...loop, current: undefined }
    : loop;
}

/**
 * A re-plan turn starts. `scope` comes from the replan action: `plan` is the
 * list it starts from (to tell later what it changed), `checkIn` marks a
 * check-in, and `itemId` a repair of that failed item, which counts toward
 * its LOOP_MAX_REPAIRS_PER_ITEM. A repair leaves the person's notes about
 * the plan for the round's re-plan, as its prompt does not carry them.
 */
export function startReplan(
  loop: LoopState,
  historyIndex: number,
  now: Date,
  scope: { plan?: TaskPlan; checkIn?: string; itemId?: string } = {},
): LoopState {
  const { plan, checkIn, itemId } = scope;
  const itemText = itemId
    ? plan?.items.find((t) => t.id === itemId)?.text
    : undefined;
  const base: LoopState = itemId
    ? {
        ...withItem(loop, itemId, {
          repairs: (itemState(loop, itemId)?.repairs ?? 0) + 1,
        }),
        repairItemId: undefined,
      }
    : {
        ...loop,
        replanRequested: false,
        answers: loop.answers.map((a) =>
          a.route === "replan" ? { ...a, delivered: true } : a,
        ),
      };
  return {
    ...base,
    ...(checkIn ? { checkInDue: undefined } : {}),
    status: "replanning",
    current: {
      kind: "replan",
      historyIndex,
      startedAt: iso(now),
      ...(plan ? { planTexts: plan.items.map((i) => i.text) } : {}),
      ...(checkIn ? { checkIn } : {}),
      ...(itemId ? { itemId } : {}),
      ...(itemText !== undefined ? { itemText } : {}),
    },
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
/** The item's status once its run has reported (or ended without a report). */
function statusAfterRun(
  loop: LoopState,
  itemId: string,
  outcome: FinishOutcome | undefined,
  run: { check?: string; overDeferred: boolean; deferred: boolean },
): LoopItemStatus {
  const outOfAttempts =
    (itemState(loop, itemId)?.attempts ?? 0) >= loop.budget.maxAttempts;
  const blocked = hasOpenBlocking(loop, itemId);
  if (outcome === "done") return run.check ? "checking" : "done";
  if (
    outcome === "waiting" &&
    !blocked &&
    loop.answers.some((a) => a.itemId === itemId && !a.delivered)
  ) {
    // It waited on a question the person answered while it ran: it runs
    // again, and its next prompt carries the answer
    return outOfAttempts ? "failed" : "pending";
  }
  // IDGAF: there is nobody to wait for
  if (outcome === "waiting" && !blocked && loop.autonomy === "idgaf") {
    return outOfAttempts ? "failed" : "pending";
  }
  if (blocked || outcome === "waiting") return "waiting";
  if (outcome === "stuck" || run.overDeferred) return "failed";
  if (run.deferred) return "pending";
  return outOfAttempts ? "failed" : "pending";
}

export function finishItemRun(
  loop: LoopState,
  report:
    { outcome: FinishOutcome; summary?: string; notes?: string } | undefined,
  /** The item's check (TaskItem.check): done then waits for it to pass */
  options: { check?: string } = {},
): LoopState {
  const itemId = loop.current?.itemId;
  if (!itemId || loop.current?.kind !== "item") return loop;
  const state = itemState(loop, itemId);
  const summary = report?.summary?.slice(0, LOOP_LIMITS.maxSummaryLength);
  const later = report?.outcome === "later" && !hasOpenBlocking(loop, itemId);
  const overDeferred = later && deferralSpent(loop, itemId);
  const deferred = later && !overDeferred;
  const status = statusAfterRun(loop, itemId, report?.outcome, {
    check: options.check,
    overDeferred,
    deferred,
  });
  const next = withItem(loop, itemId, {
    status,
    summary: overDeferred
      ? `Set aside a second time, so recorded as stuck: ${summary ?? "no reason given"}`.slice(
          0,
          LOOP_LIMITS.maxSummaryLength,
        )
      : (summary ??
        (report ? state?.summary : "The turn ended without finish_item.")),
    // Coming back later is not another try at it
    ...(deferred
      ? {
          deferrals: (state?.deferrals ?? 0) + 1,
          setAside: true,
          attempts: Math.max(0, (state?.attempts ?? 0) - 1),
        }
      : {}),
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
    ...withItem(next, itemId, { unanswered: undefined, again: undefined }),
    ...(report ? {} : releasedReminders(loop)),
    current: undefined,
    doneThisRound: loop.doneThisRound + (status === "done" ? 1 : 0),
    consecutiveFailures: failures,
    ...(notes ? { notes } : {}),
    ...strategyAfterRun(loop, state, status),
  };
}

/**
 * What the strategy keeps from a finished run. Check in: count the items
 * done, and ask for a check-in when one failed. Fix forward: a failed item
 * with repairs left waits for its repair. Either way the failure counts
 * toward the three-failures stop, so that stop still means three failed
 * runs in a row: with the default of 3, an item that fails after both its
 * repairs stops the loop unless something finished in between.
 */
function strategyAfterRun(
  loop: LoopState,
  state: LoopItemState | undefined,
  status: LoopItemStatus,
): Partial<LoopState> {
  switch (loopStrategy(loop)) {
    case "finish":
      return {};
    case "check-in":
      return {
        doneSinceReplan:
          (loop.doneSinceReplan ?? 0) + (status === "done" ? 1 : 0),
        ...(status === "failed" && state
          ? { checkInDue: `Item ${state.id} failed.` }
          : {}),
      };
    case "fix-forward":
      return status === "failed" &&
        state &&
        (state.repairs ?? 0) < LOOP_MAX_REPAIRS_PER_ITEM
        ? { repairItemId: state.id }
        : {};
  }
}

/** Check in: a done item reopened as redo asks for a check-in at once. */
function checkInOnRedo(loop: LoopState, reason: string): LoopState {
  return loopStrategy(loop) === "check-in"
    ? { ...loop, checkInDue: reason }
    : loop;
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

/** What a control the person used did to the loop, or why it was refused. */
export type LoopControlResult =
  { ok: true; loop: LoopState } | { ok: false; error: string };

/** A loop that waited on the person goes on once something changed. */
function wake(loop: LoopState): LoopState {
  return loop.status === "waiting"
    ? { ...loop, status: "running", waitingSince: undefined }
    : loop;
}

/**
 * The person skips an item that is not running. It counts as finished, so
 * the loop goes past it, but the task list shows it cancelled and it does
 * not count toward doneThisRound (it is no progress). Its open questions
 * stay open; an answer to one is kept for the item's next run, should the
 * person run it again. The running item cannot be skipped: Stop now, or Stop
 * after this item, is for that.
 */
export function skipItem(loop: LoopState, itemId: string): LoopControlResult {
  const state = itemState(loop, itemId);
  if (!state) return { ok: false, error: `No item ${itemId} in the loop` };
  if (state.status === "running") {
    return {
      ok: false,
      error: `${itemId} is running: use Stop now, or Stop after this item, instead`,
    };
  }
  // Its check is running: the result would overwrite the skip
  if (loop.current?.kind === "check" && loop.current.itemId === itemId) {
    return {
      ok: false,
      error: `${itemId}'s check is running: use Stop now, or wait for it`,
    };
  }
  if (state.skipped) {
    return { ok: false, error: `${itemId} is already skipped` };
  }
  if (state.status === "done") {
    return { ok: false, error: `${itemId} is already done` };
  }
  const { again: _again, unanswered: _unanswered, ...rest } = state;
  return {
    ok: true,
    loop: wake({
      ...loop,
      items: loop.items.map((i) =>
        i.id === itemId ? { ...rest, status: "done", skipped: true } : i,
      ),
    }),
  };
}

/**
 * The person runs a done, failed or skipped item again: it is pending with
 * no attempts, and its next run's prompt says it is a repeat at their
 * request (loopItemPrompt `again`). The running item cannot be.
 */
export function runItemAgain(
  loop: LoopState,
  itemId: string,
): LoopControlResult {
  const state = itemState(loop, itemId);
  if (!state) return { ok: false, error: `No item ${itemId} in the loop` };
  if (state.status === "running") {
    return { ok: false, error: `${itemId} is running` };
  }
  if (state.status !== "done" && state.status !== "failed") {
    return {
      ok: false,
      error:
        state.status === "waiting"
          ? `${itemId} waits on an answer: answer its question instead`
          : state.setAside
            ? `${itemId} was set aside and is still to run`
            : `${itemId} has not run yet`,
    };
  }
  const { skipped: _skipped, unanswered: _unanswered, ...rest } = state;
  // A loop that stopped because everything was done can be resumed again;
  // it never starts by itself
  const finished = loop.status === "stopped" && loop.stopReason === "done";
  return {
    ok: true,
    loop: wake({
      ...loop,
      ...(finished
        ? {
            stopReason: "stopped" as const,
            stopDetail: "An item was reopened: Resume to run it.",
          }
        : {}),
      items: loop.items.map((i) =>
        i.id === itemId
          ? { ...rest, status: "pending", attempts: 0, again: true }
          : i,
      ),
    }),
  };
}

/** The limits the person may change while the loop runs, and their bounds. */
export const LOOP_BUDGET_BOUNDS = {
  maxRounds: { min: 1, max: 50, unlimited: false },
  maxTokens: { min: 10_000, max: 50_000_000, unlimited: true },
  maxWallMs: { min: 60_000, max: 24 * HOUR, unlimited: true },
  maxAttempts: { min: 1, max: 5, unlimited: false },
  maxConsecutiveFailures: { min: 1, max: 10, unlimited: false },
} as const;

export type LoopBudgetLimit = keyof typeof LOOP_BUDGET_BOUNDS;

export const LOOP_BUDGET_LIMITS = Object.keys(
  LOOP_BUDGET_BOUNDS,
) as LoopBudgetLimit[];

/**
 * Changes the loop's limits while it runs. Every limit given must be an
 * integer within LOOP_BUDGET_BOUNDS (0 means no limit for tokens and time);
 * otherwise nothing changes. A limit lowered below what the loop has used
 * stops it at its next step. `input` may come from a request body, so it is
 * checked whatever its type. setLoopAutonomy still resets the limits to the
 * level's.
 */
export function setLoopBudget(
  loop: LoopState,
  input: unknown,
): LoopControlResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "The limits must be an object" };
  }
  const change: Partial<LoopBudget> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (!(LOOP_BUDGET_LIMITS as string[]).includes(key)) {
      return {
        ok: false,
        error: `${key} is not a limit that can be changed (${LOOP_BUDGET_LIMITS.join(", ")})`,
      };
    }
    const bounds = LOOP_BUDGET_BOUNDS[key as LoopBudgetLimit];
    const inRange =
      typeof value === "number" &&
      Number.isInteger(value) &&
      ((bounds.unlimited && value === 0) ||
        (value >= bounds.min && value <= bounds.max));
    if (!inRange) {
      return {
        ok: false,
        error: `${key} must be ${bounds.unlimited ? "0 (no limit) or " : ""}an integer from ${bounds.min} to ${bounds.max}`,
      };
    }
    change[key as LoopBudgetLimit] = value;
  }
  return { ok: true, loop: { ...loop, budget: { ...loop.budget, ...change } } };
}

/**
 * How often the loop may re-plan, which is budget.maxRounds seen from the
 * person's side: the first pass is round 1, so never is 1 round, up to N
 * re-plans is N + 1 rounds, and until done is the autonomy level's default.
 */
export type LoopReplanSetting =
  | { kind: "never" }
  | { kind: "up_to"; replans: number }
  | { kind: "until_done" };

export function loopReplanSetting(loop: LoopState): LoopReplanSetting {
  const rounds = loop.budget.maxRounds;
  if (rounds <= 1) return { kind: "never" };
  if (rounds === loopAutonomy(loop).budget.maxRounds) {
    return { kind: "until_done" };
  }
  return { kind: "up_to", replans: rounds - 1 };
}

/** The maxRounds for a re-plan setting; pass it to setLoopBudget. */
export function maxRoundsForReplan(
  loop: LoopState,
  setting: LoopReplanSetting,
): number {
  switch (setting.kind) {
    case "never":
      return 1;
    case "up_to":
      return setting.replans + 1;
    case "until_done":
      return loopAutonomy(loop).budget.maxRounds;
  }
}

/** The re-plan setting in words, for the inbox. */
export function describeLoopReplan(loop: LoopState): string {
  const setting = loopReplanSetting(loop);
  switch (setting.kind) {
    case "never":
      return "Re-plan never: one pass over the plan";
    case "up_to":
      return `Re-plan up to ${setting.replans} time${setting.replans === 1 ? "" : "s"}`;
    case "until_done": {
      const replans = loop.budget.maxRounds - 1;
      return `Re-plan until done (at most ${replans} time${replans === 1 ? "" : "s"}, the ${loopAutonomy(loop).label} level's limit)`;
    }
  }
}

/** The limits in words, for the inbox: rounds, tokens and minutes. */
export function describeLoopBudget(budget: LoopBudget): string {
  const tokens =
    budget.maxTokens > 0
      ? `${budget.maxTokens.toLocaleString("en-US")} tokens`
      : "no token limit";
  const minutes =
    budget.maxWallMs > 0
      ? `${Math.round(budget.maxWallMs / 60000)} minutes`
      : "no time limit";
  return `${budget.maxRounds} round${budget.maxRounds === 1 ? "" : "s"}, ${tokens}, ${minutes}`;
}

export type HoldResult =
  | { ok: true; loop: LoopState; question: LoopQuestion; duplicate: boolean }
  | { ok: false; error: string };

/** Records a question the running item holds for the person. */
/**
 * IDGAF: nobody answers, so the question never reaches the inbox. It is kept,
 * already closed, as a record of what the agent decided for itself.
 */
function decideAlone(
  loop: LoopState,
  itemId: string | undefined,
  question: string,
  assumption: unknown,
  now: Date,
): HoldResult {
  const decided: LoopQuestion = {
    id: nextId("q", loop.questions),
    ...(itemId ? { itemId } : {}),
    question,
    kind: "assumption",
    askedAt: iso(now),
    decidedAlone: true,
    answerId: "self",
    ...(typeof assumption === "string" && assumption.trim()
      ? { assumption: assumption.trim() }
      : {}),
  };
  return {
    ok: true,
    loop:
      loop.questions.length < LOOP_LIMITS.maxQuestions
        ? { ...loop, questions: [...loop.questions, decided] }
        : loop,
    question: decided,
    duplicate: false,
  };
}

export function holdQuestion(
  loop: LoopState,
  input: {
    itemId?: string;
    question: unknown;
    kind: unknown;
    assumption?: unknown;
    approval?: LoopQuestion["approval"];
    /** For the error texts; default the IDE's names */
    toolNames?: LoopToolNames;
  },
  now: Date,
): HoldResult {
  const names = input.toolNames ?? LOOP_TOOL_NAMES;
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
  if (loop.autonomy === "idgaf" && kind !== "approval") {
    return decideAlone(loop, input.itemId, question, input.assumption, now);
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
      error: `This item already holds ${LOOP_LIMITS.maxOpenQuestionsPerItem} open questions. Continue on your stated assumptions, or call ${names.finishItem} with outcome "waiting".`,
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
    case "checking":
      // Allowing the check lets the loop run it; not allowing it leaves
      // the item done without its check
      if (question?.kind === "approval") {
        return input.approve
          ? { route: "confirmed" }
          : {
              route: "confirmed",
              itemChange: {
                status: "done",
                check: {
                  status: "refused",
                  command: question.approval?.summary ?? "",
                  at: question.askedAt,
                },
              },
            };
      }
      return { route: confirmsAssumption ? "confirmed" : "next-run" };
    case "done":
      if (confirmsAssumption) return { route: "confirmed" };
      // The person skipped it: the answer waits for a run they ask for
      if (state.skipped) return { route: "next-run" };
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
  if (route === "redo") {
    next = checkInOnRedo(
      next,
      `The person overruled an assumption of item ${itemId}, so it is to be redone.`,
    );
  }
  if (question?.kind === "approval" && input.approve && question.approval) {
    next = {
      ...next,
      grants: [...new Set([...next.grants, question.approval.grantKey])],
    };
  }
  if (answer.replanNow) next = { ...next, replanRequested: true };
  // An answer to a loop that waited on the person resumes it.
  const unblocks =
    route !== "confirmed" ||
    !!itemChange ||
    (question?.kind === "approval" && !!input.approve);
  if (next.status === "waiting" && route !== "standing" && unblocks) {
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
      case "checking":
        status = "in_progress";
        note = open.length
          ? `Check waiting on you: ${open.map((q) => q.id).join(", ")}`
          : `Checking: ${task.check ?? "its check"}`;
        break;
      case "done":
        if (state.skipped) {
          status = "cancelled";
          note = "Skipped by you";
          break;
        }
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
      case "pending": {
        const blocked = blockingDependencies(loop, plan, task);
        const unmet = unmetDependencies(loop, plan, task);
        status = blocked.length ? "blocked" : "pending";
        note = blocked.length
          ? `Blocked on ${blocked.join(", ")}`
          : state.again
            ? "Run again: you asked for it"
            : state.check?.status === "failed"
              ? state.summary
              : unmet.length
                ? `After ${unmet.join(", ")}`
                : undefined;
        break;
      }
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
      next = checkInOnRedo(
        withItem(next, item.id, { status: "redo", attempts: 0 }),
        `The person's answer reached item ${item.id} after it finished, so it is to be redone.`,
      );
    }
  }
  return next;
}

function sameTexts(previous: string[], plan: TaskPlan): boolean {
  return (
    previous.length === plan.items.length &&
    plan.items.every((task, i) => task.text === previous[i])
  );
}

/**
 * A re-plan was accepted: the new list is the next round. Items that kept
 * their id keep their state (finished work stays done); new ones are pending;
 * failed ones that the plan kept run again.
 *
 * What the re-plan was for (LoopState.replanned, from endReplan) changes
 * that:
 * - a check-in that kept every to-do as it was is not a round: the round,
 *   the no-progress count and the failed items stay as they were;
 * - a repair counts toward maxRounds but leaves the round's progress count
 *   alone; only the repaired item runs again (other failed items stay
 *   failed), and the to-dos it was split into inherit its repairs.
 */
export function acceptReplan(
  loop: LoopState,
  plan: TaskPlan,
  ctx: LoopContext,
): LoopState {
  loop = { ...loop, ...rehomedReminders(loop, plan) };
  const scope = loop.replanned;
  const unchangedCheckIn = !!scope?.checkIn && sameTexts(scope.planTexts, plan);
  const repairOf = scope?.itemId ? itemState(loop, scope.itemId) : undefined;
  const items = plan.items.map((task) => {
    const known = itemState(loop, task.id);
    if (!known) {
      const fresh = fromTask(task);
      return repairOf?.repairs
        ? { ...fresh, repairs: repairOf.repairs }
        : fresh;
    }
    const rerun = repairOf ? known.id === repairOf.id : !unchangedCheckIn;
    // The result of a check the plan no longer has says nothing about the item
    const state =
      known.check && known.check.command !== task.check
        ? { ...known, check: undefined }
        : known;
    if (state.status === "failed" && rerun) {
      return { ...state, status: "pending" as const, attempts: 0 };
    }
    return state;
  });
  const strategyState: Partial<LoopState> = {
    replanned: undefined,
    ...(loopStrategy(loop) === "check-in"
      ? { doneSinceReplan: 0, checkInDue: undefined }
      : {}),
  };
  if (unchangedCheckIn || repairOf) {
    return {
      ...loop,
      ...strategyState,
      status: "running",
      current: undefined,
      round: unchangedCheckIn ? loop.round : loop.round + 1,
      items,
    };
  }
  const noProgressRounds =
    loop.doneThisRound === 0 ? loop.noProgressRounds + 1 : 0;
  return {
    ...loop,
    ...strategyState,
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

/** The lines a run's opening prompt carries for its reminders. */
function reminderLines(reminders?: LoopDeliveredReminder[]): string[] {
  if (!reminders?.length) return [];
  return [
    "",
    "Reminders saved by earlier runs:",
    ...reminders.map(({ reminder, staleFiles }) => {
      const from = `from item ${reminder.fromItemId}`;
      const files = reminder.files?.length
        ? `; about ${reminder.files.map((f) => f.path).join(", ")}`
        : "";
      return staleFiles.length
        ? `- (${from}; written before these files changed, so check first: ${staleFiles.join(", ")}) ${quote(reminder.note)}`
        : `- (${from}${files}) ${quote(reminder.note)}`;
    }),
  ];
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
  /** The person asked for the item to run again (LoopItemState.again) */
  again?: boolean;
  attempt: number;
  /** What earlier runs learned (LoopState.notes) */
  notes?: string[];
  /** The person's instructions for every item (standingInstructions) */
  standing?: string[];
  /** The run starts without the conversation before it */
  freshContext?: boolean;
  /** Questions of this item nobody answered in time (unattended) */
  unanswered?: LoopQuestion[];
  /** The names the model knows the tools by (default the IDE's) */
  toolNames?: LoopToolNames;
  /**
   * The request carries loopPlanBlock: the notes and the standing
   * instructions are in it, so the prompt leaves them out.
   */
  planBlock?: boolean;
  /** The last run of the item's check (LoopItemState.check) */
  lastCheck?: LoopCheckResult;
  /** What earlier runs saved for this one (takeReminders) */
  reminders?: LoopDeliveredReminder[];
  /** A run set this item aside before (finish_item outcome "later") */
  returning?: boolean;
  /** IDGAF: nobody answers, so the agent makes every decision itself */
  decideAlone?: boolean;
}): string {
  const { item } = input;
  const names = input.toolNames ?? LOOP_TOOL_NAMES;
  const lines = [
    `Work on this item of the plan, and only this item: ${quote(item.text)}`,
  ];
  if (input.planBlock) {
    lines.push(
      "The task list below shows every item's state as this run started, with the notes earlier items left; it is kept for you, so do not change it.",
    );
  }
  if (input.planFile) {
    lines.push(
      `The plan is in ${input.planFile}; read it for context. Other items are handled separately${input.freshContext ? ", and their work is in the files, not in this conversation" : ""}.`,
    );
  }
  if (input.redo) {
    lines.push(
      "This item was finished before on an assumption the person has now overruled. Redo it to match their answer below.",
    );
  } else if (input.again) {
    lines.push(
      "This item ran before, and the person asked for it to run again. Some or all of it may already be done: check what is done before you change anything, then finish or fix what is missing.",
    );
  } else if (input.attempt > 1) {
    lines.push(
      "An earlier run of this item ended without reporting. Check what is already done before you change anything.",
    );
  }
  if (input.returning) {
    lines.push(
      "An earlier run set this item aside to come back to it. Check what changed before you go on.",
    );
  }
  if (input.item.check) {
    lines.push(
      `When you report it done, its check runs: \`${quote(input.item.check)}\`. It must exit 0, so run it yourself first.`,
    );
  }
  if (input.lastCheck?.status === "failed") {
    lines.push(
      "",
      `You reported this item done, but its check \`${quote(input.lastCheck.command)}\` failed${typeof input.lastCheck.exitCode === "number" ? ` (exit ${input.lastCheck.exitCode})` : ""}. Fix what it reports:`,
      "```",
      (input.lastCheck.output ?? "(no output)").trim(),
      "```",
    );
  }
  if (input.unanswered?.length) {
    lines.push(
      "",
      "Nobody answered these questions in time, so go on without the answers:",
    );
    for (const q of input.unanswered) lines.push(`- ${quote(q.question)}`);
    lines.push(
      `For each, take your best default and record it with ${names.holdQuestion} kind "assumption". Do not do anything that cannot be undone on such a default; leave that part and say so in the summary.`,
    );
  }
  if (input.standing?.length && !input.planBlock) {
    lines.push("", "The person's instructions for every item:");
    for (const s of input.standing) lines.push(`- ${quote(s)}`);
  }
  if (input.notes?.length && !input.planBlock) {
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
  lines.push(...reminderLines(input.reminders));
  lines.push(
    "",
    "Search the code before you add anything: do not assume something is missing because one search did not find it. Implement the item fully, with no placeholders or stubs.",
    "",
    "Before you report it done, run the checks the project has for what you changed (tests, type check, lint) and fix what fails; name them in your summary, or say there was nothing to run.",
    "",
    `When the item is done, call ${names.finishItem} with outcome "done" and a one-line summary. If you cannot finish it, call ${names.finishItem} with outcome "stuck" and say why. Put anything a later item should know (a command that works, a trap you hit) in \`notes\`: one or two lines, not progress.`,
    "",
    `If you learn something a later item or a retry will need, save it with ${names.remindMe} now.`,
    "",
    input.decideAlone
      ? "Nobody will answer questions on this run. Make every decision yourself, even important ones, and say what you chose in your summary."
      : `Ask, rather than decide silently: whenever the person might want a say (a choice between approaches, scope, naming, an irreversible step, or anything the plan does not settle), call ${names.holdQuestion}. Use kind "assumption" by default: state the choice you are making in \`assumption\` and keep working; the person can overrule it later. Use kind "blocking" only when there is no reasonable default, then stop and call ${names.finishItem} with outcome "waiting". Write each question so it can be answered without this conversation: name the item, the options and your default.`,
  );
  return lines.join("\n");
}

const STATUS_MARK: Record<LoopItemStatus, string> = {
  pending: "[ ]",
  redo: "[ ]",
  running: "[>]",
  checking: "[~]",
  done: "[x]",
  waiting: "[?]",
  failed: "[!]",
};

/** How long a slot's summary and questions may be in the plan block. */
export const LOOP_PLAN_BLOCK_LIMITS = {
  summaryLength: 160,
  questionLength: 160,
} as const;

function clip(text: string, max: number): string {
  const flat = quote(text).trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * The plan as a running item sees it: one slot per item with its state, what
 * its run reported and the questions it holds, the running item marked, then
 * the notes earlier runs left and the person's standing instructions, in the
 * task list block's <task_list> tag. Every request of an item's run carries
 * it after the item prompt (loopRunPlanBlock, withLoopPlanBlock): the run
 * starts without the earlier turns but never without the plan. It marks the
 * item; it never asks the model to choose one. Empty without items.
 */
export function loopPlanBlock(input: {
  loop: LoopState;
  plan: TaskPlan;
  toolNames?: LoopToolNames;
}): string {
  const { loop, plan } = input;
  if (plan.items.length === 0) return "";
  const names = input.toolNames ?? LOOP_TOOL_NAMES;
  const currentId =
    loop.current?.kind === "item" ? loop.current.itemId : undefined;
  const lines = [
    TASK_LIST_BLOCK_OPEN,
    `The plan, kept for you and read-only. Work only on the item marked "<- this item"; report it with ${names.finishItem} and ask with ${names.holdQuestion}. Markers: [ ] to do, [>] this item, [~] its check runs next, [x] done, [?] waiting on the person, [!] failed.`,
  ];
  for (const task of plan.items) {
    const state = itemState(loop, task.id);
    const status = state?.status ?? "pending";
    let line = `${STATUS_MARK[status]} ${task.id}. ${quote(task.text)}`;
    const blocked = blockingDependencies(loop, plan, task);
    const unmet = unmetDependencies(loop, plan, task);
    if (task.id === currentId) {
      line += `  <- this item (attempt ${state?.attempts ?? 1} of ${loop.budget.maxAttempts})`;
    } else if (status === "checking") {
      line += " (its check runs next)";
    } else if (blocked.length) {
      line += ` (blocked: ${blocked.join(", ")} failed or skipped)`;
    } else if (unmet.length && status !== "done") {
      line += ` (after ${unmet.join(", ")})`;
    } else if (status === "redo") {
      line += " (to be redone: an assumption was overruled)";
    } else if (status === "waiting") {
      line += " (waiting on the person)";
    } else if (state?.skipped) {
      line += " (skipped by the person: not done)";
    } else if (state?.again) {
      line += " (to be run again at the person's request)";
    }
    if (
      (status === "done" || status === "failed") &&
      !state?.skipped &&
      state?.summary
    ) {
      line += `: ${clip(state.summary, LOOP_PLAN_BLOCK_LIMITS.summaryLength)}`;
    }
    lines.push(line);
    if (task.check) {
      const result = state?.check
        ? ` (last run: ${state.check.status}${typeof state.check.exitCode === "number" ? `, exit ${state.check.exitCode}` : ""})`
        : "";
      lines.push(`    check: ${quote(task.check)}${result}`);
    }
    for (const q of openQuestions(loop, task.id)) {
      const assumed = q.assumption
        ? ` Assumed: ${clip(q.assumption, LOOP_PLAN_BLOCK_LIMITS.questionLength)}`
        : "";
      lines.push(
        `    ${q.id} (${q.kind}): ${clip(q.question, LOOP_PLAN_BLOCK_LIMITS.questionLength)}${assumed}`,
      );
    }
  }
  if (loop.notes?.length) {
    lines.push("", "Notes from earlier items:");
    for (const n of loop.notes) lines.push(`- ${quote(n)}`);
  }
  const standing = standingInstructions(loop);
  if (standing.length) {
    lines.push("", "The person's instructions for every item:");
    for (const s of standing) lines.push(`- ${quote(s)}`);
  }
  lines.push(TASK_LIST_BLOCK_CLOSE);
  return lines.join("\n");
}

/**
 * The key of the running item's run: the same for every request of one run
 * and new for the next. A harness keeps the plan block it computed for this
 * key (loopRunPlanBlock) instead of rebuilding it per request.
 */
export function loopRunKey(loop: LoopState): string | undefined {
  const current = loop.current;
  if (current?.kind !== "item") return undefined;
  return `${current.itemId}:${current.historyIndex}:${current.startedAt}`;
}

/**
 * The plan block for every request of an item's run: loopPlanBlock as it
 * stood at the run's first request, kept in `memo` until the run changes. It
 * goes into the run's first message (withLoopPlanBlock), never after the
 * newest one: a prompt cache matches a request only up to the first token
 * that differs, so a block that moves or changes inside a run makes
 * everything after it uncached, and a trailing user message also makes Qwen's
 * chat template drop the reasoning of every earlier assistant turn. What
 * changes during the run reaches the model where it happens: a held question
 * in its tool result, an answer as a steered message.
 */
export function loopRunPlanBlock(
  memo: { key?: string; block?: string },
  input: { loop: LoopState; plan: TaskPlan; toolNames?: LoopToolNames },
): string {
  const key = loopRunKey(input.loop);
  if (!key) return "";
  if (memo.key !== key || memo.block === undefined) {
    memo.key = key;
    memo.block = loopPlanBlock(input);
  }
  return memo.block;
}

/**
 * A message's content with the plan block after it, for the run's first
 * message (the item prompt). A string stays a string; a list of parts gets
 * one more text part.
 */
export function withLoopPlanBlock(
  content: MessageContent,
  block: string,
): MessageContent {
  if (!block) return content;
  if (typeof content === "string") {
    return content ? `${content}\n\n${block}` : block;
  }
  return [...content, { type: "text", text: block }];
}

/** One line per item with its state, for the re-plan prompts. */
function itemLines(loop: LoopState, plan: TaskPlan): string[] {
  return plan.items.map((task) => {
    const state = itemState(loop, task.id);
    const status = state?.status ?? "pending";
    if (state?.skipped) {
      return `- ${STATUS_MARK[status]} ${quote(task.text)} (skipped by the person)`;
    }
    const detail =
      status === "waiting"
        ? `waiting on: ${openQuestions(loop, task.id)
            .map((q) => quote(q.question))
            .join("; ")}`
        : state?.summary
          ? quote(state.summary)
          : "";
    return `- ${STATUS_MARK[status]} ${quote(task.text)} (${status}${detail ? `: ${detail}` : ""})`;
  });
}

/**
 * The prompt for a repair (fix forward): a re-plan of one failed item only,
 * sent in Plan mode like any re-plan. It asks to reword, split or drop that
 * item and to keep every other to-do as it is (see repairDecision).
 */
export function loopItemRepairPrompt(input: {
  loop: LoopState;
  plan: TaskPlan;
  itemId: string;
  planFile?: string;
  planTitle?: string;
  /** The names the model knows the tools by (default the IDE's) */
  toolNames?: LoopToolNames;
  /** What earlier runs saved for this re-plan (takeReminders) */
  reminders?: LoopDeliveredReminder[];
}): string {
  const { loop, plan } = input;
  const names = input.toolNames ?? LOOP_TOOL_NAMES;
  const task = plan.items.find((t) => t.id === input.itemId);
  const state = itemState(loop, input.itemId);
  const lines = [
    `This item of the plan${input.planFile ? ` in ${input.planFile}` : ""} failed: ${quote(task?.text ?? input.itemId)}`,
    `What its run reported: ${quote(state?.summary ?? "nothing")}`,
    "",
    "Re-plan this item only, so the plan can go on. The plan:",
    ...itemLines(loop, plan),
  ];
  const assumptions = openQuestions(loop, input.itemId).filter(
    (q) => q.kind === "assumption",
  );
  if (assumptions.length > 0) {
    lines.push("", "Assumptions it made:");
    for (const q of assumptions) {
      lines.push(
        `- ${quote(q.question)} Assumed: ${quote(q.assumption ?? "")}`,
      );
    }
  }
  if (loop.notes?.length) {
    lines.push("", "Notes from the runs:");
    for (const n of loop.notes) lines.push(`- ${quote(n)}`);
  }
  lines.push(...reminderLines(input.reminders));
  lines.push(
    "",
    `Find out why it failed: read the code and what the run left. Then do one of these: reword the item so a run can finish it; split it into at most ${LOOP_REPAIR_MAX_TODOS} smaller to-dos that replace it, in its place; or drop it if the plan's goal does not need it, or it is already done.`,
    "",
    `Then call ${names.presentPlan}${input.planTitle ? ` with the title "${quote(input.planTitle)}"` : ""} with the whole list: every other to-do word for word and in its place, with this one reworded, split or left out. Do not change, add or drop any other to-do.`,
  );
  return lines.join("\n");
}

/** The prompt for the turn of a replan action: a repair, a check-in or a round's re-plan. */
export function loopReplanTurnPrompt(
  action: { checkIn?: string; itemId?: string },
  input: {
    loop: LoopState;
    plan: TaskPlan;
    planFile?: string;
    planTitle?: string;
    toolNames?: LoopToolNames;
    reminders?: LoopDeliveredReminder[];
  },
): string {
  return action.itemId
    ? loopItemRepairPrompt({ ...input, itemId: action.itemId })
    : loopReplanPrompt({ ...input, checkIn: action.checkIn });
}

/** The prompt for a re-plan turn (sent in Plan mode, so it can only read). */
export function loopReplanPrompt(input: {
  loop: LoopState;
  plan: TaskPlan;
  planFile?: string;
  planTitle?: string;
  /** The names the model knows the tools by (default the IDE's) */
  toolNames?: LoopToolNames;
  /** A check-in between items (check-in strategy): why it is due */
  checkIn?: string;
  /** What earlier runs saved for this re-plan (takeReminders) */
  reminders?: LoopDeliveredReminder[];
}): string {
  const { loop, plan } = input;
  const names = input.toolNames ?? LOOP_TOOL_NAMES;
  const where = input.planFile ? ` in ${input.planFile}` : "";
  const lines = input.checkIn
    ? [
        `Check in on the plan${where} before the next item: ${quote(input.checkIn)} Re-evaluate the plan against what has happened.`,
        "If it still holds, present it unchanged, every to-do word for word and in the same order; then the loop goes on without starting a new round.",
      ]
    : [
        `No item of the plan can run now. Re-evaluate the plan${where} against what has happened, and propose the next round.`,
      ];
  lines.push("", "Items:", ...itemLines(loop, plan));
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
  lines.push(...reminderLines(input.reminders));
  lines.push(
    "",
    "The plan may be wrong. Check its open items against the code before you keep them: drop what is already done, and do not add what already exists.",
    "",
    `Read what you need, then call ${names.presentPlan}${input.planTitle ? ` with the title "${quote(input.planTitle)}"` : ""} with the updated to-dos. Keep finished to-dos word for word so they stay done. Reword or split items that failed, drop what is no longer needed, and add only work the plan's goal requires. Leave items that wait on the person in the list as they are.`,
  );
  return lines.join("\n");
}

/** One line for the loop's state, for the inbox header and the CLI. */
export function formatLoopStatus(
  loop: LoopState,
  options: { level?: boolean } = {},
): string {
  const skipped = loop.items.filter((i) => i.skipped).length;
  const done = loop.items.filter((i) => i.status === "done").length - skipped;
  const waiting = loop.items.filter((i) => i.status === "waiting").length;
  const checking = loop.items.filter((i) => i.status === "checking").length;
  const open = loop.questions.filter((q) => !q.answerId).length;
  // A strategy is named when it is not the level's default (and a loop saved
  // before strategies names none); with level: false the pickers show both.
  const strategy =
    options.level !== false &&
    loop.strategy &&
    loop.strategy !== defaultLoopStrategy(loop.autonomy ?? "auto")
      ? [LOOP_STRATEGIES[loop.strategy].label]
      : [];
  const parts = [
    ...(options.level === false ? [] : [loopAutonomy(loop).label]),
    ...strategy,
    `Round ${loop.round}`,
    `${done}/${loop.items.length} done`,
  ];
  if (skipped) parts.push(`${skipped} skipped`);
  const deferred = loop.items.filter((i) => i.deferrals).length;
  if (deferred) parts.push(`${deferred} deferred`);
  if (waiting) parts.push(`${waiting} waiting on you`);
  if (checking) parts.push(`${checking} checking`);
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

/** finish_item's result, knowing what the report will come to on this item. */
export function finishItemResultFor(
  loop: LoopState,
  itemId: string,
  outcome: FinishOutcome,
): string {
  if (outcome === "later" && hasOpenBlocking(loop, itemId)) {
    return "This item has an open blocking question, so it waits for the answer instead. End your turn now.";
  }
  return finishItemResult(outcome, deferralSpent(loop, itemId));
}

/** Text of the tool result for finish_item. */
export function finishItemResult(
  outcome: FinishOutcome,
  /** deferralSpent, before this report: "later" is then recorded as stuck */
  spent = false,
): string {
  switch (outcome) {
    case "later":
      return spent
        ? "This item was already set aside once, so it is recorded as stuck. End your turn now."
        : "Set aside; it comes back after the other items. End your turn now.";
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
  names: LoopToolNames = LOOP_TOOL_NAMES,
): string {
  if (question.decidedAlone) {
    return `Nobody will answer this: this loop decides for itself. Go on with your best judgment, even if the decision is important, and say what you chose in your summary. Do not report "waiting".`;
  }
  const prefix = duplicate
    ? `You already asked this (${question.id}).`
    : `Question ${question.id} is in the person's inbox.`;
  return question.kind === "assumption"
    ? `${prefix} Keep working on your assumption; if they overrule it, the item will be redone.`
    : `${prefix} Do what you can without the answer, then call ${names.finishItem} with outcome "waiting".`;
}

/** What the model sees when a tool call that would ask is held as a question. */
export function approvalHeldResult(
  question: LoopQuestion,
  names: LoopToolNames = LOOP_TOOL_NAMES,
): string {
  return `This call needs the person's approval, so it was not run. It is held as question ${question.id} in their inbox. Do not try to reach the same result another way. Do what you can without it, then call ${names.finishItem} with outcome "waiting"; the item will run again once they answer.`;
}

const FINISH_OUTCOMES: FinishOutcome[] = ["done", "waiting", "stuck", "later"];

/** The report a finish_item call makes, from its arguments. */
export function finishItemReport(args: unknown):
  | {
      ok: true;
      report: { outcome: FinishOutcome; summary?: string; notes?: string };
      /** Outcome "later": the note for the item's return, and its files */
      later?: { note: string; files: string[] };
    }
  | { ok: false; error: string } {
  const a = (args ?? {}) as Record<string, unknown>;
  const outcome = a.outcome as FinishOutcome;
  if (!FINISH_OUTCOMES.includes(outcome)) {
    return {
      ok: false,
      error: `outcome must be one of ${FINISH_OUTCOMES.join(", ")}`,
    };
  }
  const summary =
    typeof a.summary === "string"
      ? a.summary.trim().slice(0, LOOP_LIMITS.maxSummaryLength)
      : undefined;
  const notes =
    typeof a.notes === "string"
      ? a.notes.trim().slice(0, LOOP_LIMITS.maxNoteLength)
      : undefined;
  const reminder = typeof a.reminder === "string" ? a.reminder.trim() : "";
  if (outcome === "later") {
    if (!reminder) {
      return {
        ok: false,
        error:
          'outcome "later" needs `reminder`: what you tried, what you learned, and why it may go better later.',
      };
    }
    if (reminder.length > LOOP_REMINDER_LIMITS.maxLength) {
      return {
        ok: false,
        error: `reminder is ${reminder.length} characters, over the limit of ${LOOP_REMINDER_LIMITS.maxLength}. Shorten it and report again.`,
      };
    }
  }
  return {
    ok: true,
    report: {
      outcome,
      ...(summary ? { summary } : {}),
      ...(notes ? { notes } : {}),
    },
    ...(outcome === "later"
      ? { later: { note: reminder, files: reminderFilePaths(a.files) } }
      : {}),
  };
}
