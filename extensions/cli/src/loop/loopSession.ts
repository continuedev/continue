import path from "path";
import { fileURLToPath } from "url";

import type {
  ChatHistoryItem,
  LoopAutonomy,
  LoopQuestion,
  LoopState,
  LoopStrategy,
  TaskPlan,
} from "core/index.js";
import {
  acceptReplan,
  answerLoop,
  createLoop,
  interruptLoop,
  LOOP_CLI_TOOL_NAMES,
  loopAutonomyFor,
  requestStop,
  resumeLoop,
  runItemAgain,
  setLoopAutonomy,
  setLoopBudget,
  skipItem,
  setLoopStrategy,
  loopRunPlanBlock,
  stopLoop,
  taskPlanWithLoop,
  withLoopPlanBlock,
  type LoopAnswerInput,
  type LoopControlResult,
} from "core/util/loopMode.js";
import { createHistoryItem } from "core/util/messageConversion.js";
import { useForLoopTurn } from "core/util/modelUse.js";

import { isAutoReviewEnabled } from "../permissions/coreRules.js";
import type { PermissionMode } from "../permissions/types.js";
import {
  applyModelForUse,
  serviceContainer,
  services,
} from "../services/index.js";
import { SERVICE_NAMES } from "../services/types.js";
import {
  getSessionLoop,
  getSessionPlanFile,
  getSessionTaskPlan,
  getSessionUsage,
  updateSessionLoop,
  updateSessionTaskPlan,
} from "../session.js";
import { reloadPlanFile } from "../util/planFileReload.js";

/**
 * Loop mode in the CLI: the session side. The decisions are core's
 * (core/util/loopMode.ts); this applies them to the CLI session, keeps the
 * task list in step, and holds what lives only while the process runs: the
 * steered answers not yet delivered and the turn-end request. The driver is
 * loopDriver.ts. Design: plans/loop-mode.md.
 */

/** What the model knows the loop's tools by in the CLI. */
export const CLI_LOOP_TOOL_NAMES = LOOP_CLI_TOOL_NAMES;

export { getSessionLoop };

/** Stores the loop on the session and makes the task list show its statuses. */
export function commitLoop(loop: LoopState | undefined): void {
  const wasActive = isActiveLoop(getSessionLoop());
  updateSessionLoop(loop);
  const plan = getSessionTaskPlan();
  if (loop && plan) {
    const synced = taskPlanWithLoop(plan, loop);
    if (synced !== plan) updateSessionTaskPlan(synced);
  }
  if (wasActive && !isActiveLoop(loop)) afterLoopEnded();
}

function isActiveLoop(loop: LoopState | undefined): boolean {
  return !!loop && loop.status !== "stopped";
}

// --- Loop as a mode: the "loop" stop on Shift+Tab ---
//
// Not a permission mode: underneath it is plan mode (the first message
// plans) plus this flag, kept in memory for the process, not on the session.
// With it set, PresentPlan builds in a loop without asking. Item runs and
// re-plans still switch between the working mode and plan mode as before.

/** What Shift+Tab cycles through and the mode indicator shows. */
export type ModeEntry = PermissionMode | "loop";
export const MODE_ENTRIES: ModeEntry[] = ["normal", "plan", "loop", "auto"];

let loopEntry = false;
/** The mode the person picked while an item ran; taken when the loop stops. */
let modeAfterLoop: PermissionMode | undefined;
const modeEntryListeners = new Set<() => void>();

function notifyModeEntry(): void {
  for (const listener of modeEntryListeners) listener();
}

/** Calls `listener` whenever the shown entry may change; returns an unsubscribe. */
export function onModeEntryChange(listener: () => void): () => void {
  modeEntryListeners.add(listener);
  return () => {
    modeEntryListeners.delete(listener);
  };
}

/** Whether the person chose the loop entry. */
export function isLoopEntry(): boolean {
  return loopEntry;
}

/** The entry the indicator shows: loop, the pending pick, or the mode. */
export function currentModeEntry(): ModeEntry {
  if (loopEntry) return "loop";
  return modeAfterLoop ?? services.toolPermissions.getCurrentMode();
}

/** Switches the permission mode and refreshes what the TUI reads of it. */
function switchPermissionMode(mode: PermissionMode): void {
  services.toolPermissions.switchMode(mode);
  serviceContainer.set(
    SERVICE_NAMES.TOOL_PERMISSIONS,
    services.toolPermissions.getState(),
  );
}

/**
 * Chooses an entry. Loop sets plan mode (unless a loop already runs in its
 * own mode). Leaving Loop while a loop runs stops it after the running step,
 * and the new mode is taken then, so the item finishes in its own mode.
 */
export function selectModeEntry(entry: ModeEntry): void {
  if (entry === "loop") {
    modeAfterLoop = undefined;
    loopEntry = true;
    if (!isActiveLoop(getSessionLoop())) switchPermissionMode("plan");
    notifyModeEntry();
    return;
  }
  const wasLoop = loopEntry;
  loopEntry = false;
  if (wasLoop && isActiveLoop(getSessionLoop())) {
    modeAfterLoop = entry;
    // Stops at once when nothing runs, and afterLoopEnded takes the mode
    requestLoopStop();
  } else {
    modeAfterLoop = undefined;
    switchPermissionMode(entry);
  }
  notifyModeEntry();
}

/** Shift+Tab or Right: the entry after the one shown; Left: the one before. */
export function cycleModeEntry(step: 1 | -1 = 1): ModeEntry {
  const index = MODE_ENTRIES.indexOf(currentModeEntry());
  const count = MODE_ENTRIES.length;
  const next = MODE_ENTRIES[(index + step + count) % count];
  selectModeEntry(next);
  return next;
}

/** The loop stopped: take the pending pick, or plan again in the loop entry. */
function afterLoopEnded(): void {
  if (modeAfterLoop) {
    const mode = modeAfterLoop;
    modeAfterLoop = undefined;
    switchPermissionMode(mode);
  } else if (loopEntry) {
    switchPermissionMode("plan");
  } else {
    return;
  }
  notifyModeEntry();
}

/** Prompt plus completion tokens the session has used, for the budgets. */
export function sessionTokens(): number {
  const usage = getSessionUsage();
  return (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
}

/**
 * The CLI's approval setting in core's terms, for loopAutonomyFor: the
 * `auto` mode allows everything (YOLO); `--auto-review` lets a reviewer
 * model answer (Auto); otherwise the person approves (Manual).
 */
export function cliApprovalMode(
  mode: PermissionMode,
): "manual" | "auto" | "yolo" {
  if (mode === "auto") return "yolo";
  if (isAutoReviewEnabled()) return "auto";
  return "manual";
}

/** The plan file as a path for the model and the person, when there is one. */
export function planFileDisplayPath(
  uri = getSessionPlanFile(),
  cwd = process.cwd(),
): string | undefined {
  if (!uri) return undefined;
  try {
    const file = uri.startsWith("file:") ? fileURLToPath(uri) : uri;
    const relative = path.relative(cwd, file);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      return relative.split(path.sep).join("/");
    }
    return file;
  } catch {
    return uri;
  }
}

/** The plan file's path on disk, when the session has one. */
export function planFilePath(uri = getSessionPlanFile()): string | undefined {
  if (!uri) return undefined;
  try {
    return uri.startsWith("file:") ? fileURLToPath(uri) : uri;
  } catch {
    return undefined;
  }
}

// --- Modes: item runs are the person's working mode, re-plans Plan mode ---

let modeBeforeReplan: PermissionMode | undefined;

/**
 * An item runs in the mode the person works in, never in Plan mode. Its model
 * (`modeModels.loop`, else the agent model) is switched where the turn is
 * sent: prepareLoopTurn.
 */
export function enterItemMode(): void {
  const permissions = services.toolPermissions;
  if (permissions.getCurrentMode() === "plan") {
    permissions.switchMode(modeBeforeReplan ?? "normal");
  }
  modeBeforeReplan = undefined;
}

/** A re-plan runs in Plan mode, whose policies keep it read-only. */
export function enterReplanMode(): void {
  const permissions = services.toolPermissions;
  const mode = permissions.getCurrentMode();
  if (mode !== "plan") {
    modeBeforeReplan = mode;
    permissions.switchMode("plan");
  }
}

/**
 * Before a Loop turn is sent: switch to the model `modeModels` gives it
 * (`loop` for an item, `replan` otherwise, falling back to the agent and plan
 * entries). Awaited, so the turn goes to that model and not the one before.
 */
export async function prepareLoopTurn(kind: "item" | "replan"): Promise<void> {
  await applyModelForUse(useForLoopTurn(kind));
}

// --- Starting, accepting a re-plan, stopping, resuming ---

/**
 * "Build in a loop": seed the loop from the session's task list, which the
 * plan's to-dos just became. The level follows the approval mode the items
 * will run in.
 */
export function startLoopFromPlan(
  mode: PermissionMode = services.toolPermissions.getCurrentMode(),
  now = new Date(),
): LoopState | undefined {
  const file = planFilePath();
  if (file) reloadPlanFile(file);
  const plan = getSessionTaskPlan();
  if (!plan) return undefined;
  const loop = createLoop(plan, {
    now,
    sessionTokens: sessionTokens(),
    autonomy: loopAutonomyFor(cliApprovalMode(mode)),
  });
  pendingSteers.length = 0;
  turnEndRequested = false;
  commitLoop(loop);
  return loop;
}

/**
 * Continue the loop with the re-plan's plan: read the plan file back (the
 * person may have edited it) and start the next round.
 */
export function acceptLoopPlan(now = new Date()): boolean {
  const loop = getSessionLoop();
  if (!loop || loop.status !== "awaiting_plan") return false;
  const file = planFilePath();
  if (file) reloadPlanFile(file);
  const plan: TaskPlan | undefined = getSessionTaskPlan();
  if (!plan) return false;
  commitLoop(acceptReplan(loop, plan, { now, sessionTokens: sessionTokens() }));
  return true;
}

/** Stop loop: at once when nothing runs, otherwise after the running step. */
export function requestLoopStop(): void {
  const loop = getSessionLoop();
  if (!loop || loop.status === "stopped") return;
  commitLoop(requestStop(loop));
}

/** Esc or a failed turn during a step: the item goes back to pending. */
export function interruptRunningLoop(detail?: string): void {
  const loop = getSessionLoop();
  if (!loop?.current) return;
  pendingSteers.length = 0;
  turnEndRequested = false;
  commitLoop(detail ? stopLoop(loop, "stopped", detail) : interruptLoop(loop));
}

export function resumeStoppedLoop(now = new Date()): boolean {
  const loop = getSessionLoop();
  if (!loop || loop.status !== "stopped") return false;
  commitLoop(resumeLoop(loop, { now, sessionTokens: sessionTokens() }));
  return true;
}

export function setRunningLoopAutonomy(autonomy: LoopAutonomy): boolean {
  const loop = getSessionLoop();
  if (!loop) return false;
  commitLoop(setLoopAutonomy(loop, autonomy));
  return true;
}

// --- Controls: skip, run again, the limits ---

/** Applies one of core's controls to the session's loop. */
function applyControl(
  apply: (loop: LoopState) => LoopControlResult,
): LoopControlResult {
  const loop = getSessionLoop();
  if (!loop) return { ok: false, error: "No loop in this session" };
  const result = apply(loop);
  if (result.ok) commitLoop(result.loop);
  return result;
}

/** Skip an item that is not running (core's skipItem). */
export function skipLoopItem(itemId: string): LoopControlResult {
  return applyControl((loop) => skipItem(loop, itemId));
}

/** Run a done, failed or skipped item again (core's runItemAgain). */
export function runLoopItemAgain(itemId: string): LoopControlResult {
  return applyControl((loop) => runItemAgain(loop, itemId));
}

/** Change the limits; core checks the bounds (setLoopBudget). */
export function setRunningLoopBudget(input: unknown): LoopControlResult {
  return applyControl((loop) => setLoopBudget(loop, input));
}

/** The strategy picker: how the running loop moves through the plan. */
export function setRunningLoopStrategy(strategy: LoopStrategy): boolean {
  const loop = getSessionLoop();
  if (!loop) return false;
  commitLoop(setLoopStrategy(loop, strategy));
  return true;
}

// --- Answers ---

interface PendingSteer {
  answerId: string;
  text: string;
}

/** Steered answers waiting for the running item's next tool boundary. */
const pendingSteers: PendingSteer[] = [];

/**
 * The person answered from the inbox or through `cn serve`. Core routes it by
 * the item's state; an answer for the running item waits for its next tool
 * boundary (takeLoopSteerItem), as a steered message does.
 */
export function answerLoopQuestion(
  input: LoopAnswerInput,
  now = new Date(),
):
  { ok: true; route: string; answerId: string } | { ok: false; error: string } {
  const loop = getSessionLoop();
  if (!loop) return { ok: false, error: "No loop is running" };
  const result = answerLoop(loop, input, now);
  if (!result.ok) return result;
  const { answer } = result;
  commitLoop(result.loop);
  if (answer.route === "steer") {
    const question = result.loop.questions.find(
      (q: LoopQuestion) => q.id === answer.questionId,
    );
    pendingSteers.push({
      answerId: answer.id,
      text: question
        ? `The person answered your question ${question.id} ("${question.question}"): ${answer.text}`
        : `A note from the person about this item: ${answer.text}`,
    });
  }
  return { ok: true, route: answer.route, answerId: answer.id };
}

/** Steered answers that have not reached the run yet. */
export function pendingSteerIds(): string[] {
  return pendingSteers.map((s) => s.answerId);
}

/** Forgets the steered answers that did not reach the run (it ended). */
export function dropPendingSteers(): void {
  pendingSteers.length = 0;
}

/**
 * At a tool boundary of the running item: the steered answers as one user
 * message, which then count as delivered.
 */
export function takeLoopSteerItem(): ChatHistoryItem | undefined {
  const loop = getSessionLoop();
  if (!pendingSteers.length || loop?.current?.kind !== "item") {
    return undefined;
  }
  const text = pendingSteers.map((s) => s.text).join("\n\n");
  pendingSteers.length = 0;
  return createHistoryItem({ role: "user", content: text }, []);
}

/** One user message from the loop's steered answers and the person's own. */
function mergeSteerItems(
  loopItem: ChatHistoryItem | undefined,
  personItem: ChatHistoryItem | undefined,
): ChatHistoryItem | undefined {
  if (!loopItem) return personItem;
  if (!personItem) return loopItem;
  const loopText = String(loopItem.message.content);
  const content = personItem.message.content;
  return {
    ...personItem,
    message: {
      ...personItem.message,
      content:
        typeof content === "string"
          ? `${loopText}\n\n${content}`
          : ([{ type: "text", text: loopText }, ...(content as any[])] as any),
    } as ChatHistoryItem["message"],
  };
}

/**
 * Wraps a host's tool-boundary callback so the loop's steered answers go in
 * at the same boundary, ahead of what the person steered with.
 */
export function withLoopSteering(
  onToolBoundary?: () => Promise<ChatHistoryItem | undefined>,
): () => Promise<ChatHistoryItem | undefined> {
  return async () => {
    const loopItem = takeLoopSteerItem();
    const personItem = onToolBoundary ? await onToolBoundary() : undefined;
    return mergeSteerItems(loopItem, personItem);
  };
}

// --- The turn ---

let turnEndRequested = false;

/**
 * FinishItem, or a plan presented by a re-plan or for "Build in a loop":
 * the loop decides what comes next, so the turn ends without another model
 * request.
 */
export function requestLoopTurnEnd(): void {
  turnEndRequested = true;
}

/**
 * Whether the main session's turn should end now; reading it clears it. A
 * subagent's or compaction's run leaves the request for the main turn.
 */
export function consumeLoopTurnEnd(isCompacting = false): boolean {
  if (!turnEndRequested || !isMainHistory(isCompacting)) return false;
  turnEndRequested = false;
  return true;
}

/**
 * The main session's history is what the service holds; a subagent's run
 * turns the service off for its own history, and compaction sends its own.
 */
function isMainHistory(isCompacting: boolean): boolean {
  if (isCompacting) return false;
  const svc = services.chatHistory;
  return typeof svc?.isReady === "function" && svc.isReady();
}

/**
 * The history a request of the loop's run is built from. Each item and
 * re-plan is sent without the turns before it (LoopState freshContext): the
 * request starts at the run's own prompt, while the history, and the screen,
 * keep everything. An item's prompt also carries the plan block, fixed for
 * the run (core's loopRunPlanBlock), so every request of the run only
 * extends the one before it and a prompt cache keeps matching.
 */
export function loopRequestHistory(
  history: ChatHistoryItem[],
  isCompacting = false,
): ChatHistoryItem[] {
  const loop = getSessionLoop();
  if (!loop?.current || !isMainHistory(isCompacting)) return history;
  const start = Math.min(loop.current.historyIndex, history.length);
  const block = loopPlanBlockForRequest(isCompacting);
  const withPlan =
    block && history[start]
      ? [
          ...history.slice(0, start),
          {
            ...history[start],
            message: {
              ...history[start].message,
              content: withLoopPlanBlock(history[start].message.content, block),
            } as ChatHistoryItem["message"],
          },
          ...history.slice(start + 1),
        ]
      : history;
  return loop.freshContext === false ? withPlan : withPlan.slice(start);
}

/** Whether the loop is running an item or a re-plan in the main session. */
export function loopRunGoing(): boolean {
  return !!getSessionLoop()?.current;
}

/** Whether the loop is running an item in the main session. */
export function loopItemRunning(): boolean {
  return getSessionLoop()?.current?.kind === "item";
}

/**
 * The plan block of the running item's run (core's loopRunPlanBlock): every
 * slot, the notes and the standing instructions as they stood at the run's
 * first request, the same for every request of the run. loopRequestHistory
 * puts it after the item prompt. "" outside an item's run, and for a
 * subagent's or compaction's request.
 */
export function loopPlanBlockForRequest(isCompacting = false): string {
  const loop = getSessionLoop();
  if (loop?.current?.kind !== "item" || !isMainHistory(isCompacting)) {
    return "";
  }
  const plan = getSessionTaskPlan();
  if (!plan) return "";
  return loopRunPlanBlock(runPlanMemo, {
    loop,
    plan,
    toolNames: CLI_LOOP_TOOL_NAMES,
  });
}

/** The plan block of the current run, kept between its requests. */
const runPlanMemo: { key?: string; block?: string } = {};

/** For tests: forget what lives only in memory. */
export function resetLoopMemory(): void {
  pendingSteers.length = 0;
  turnEndRequested = false;
  modeBeforeReplan = undefined;
  loopEntry = false;
  modeAfterLoop = undefined;
  runPlanMemo.key = undefined;
  runPlanMemo.block = undefined;
}
