import type { LoopState, TaskPlan } from "core/index.js";
import {
  describeLoopBudget,
  describeLoopReplan,
  loopReplanSetting,
  maxRoundsForReplan,
  type LoopReplanSetting,
} from "core/util/loopMode.js";

import {
  interruptRunningLoop,
  runLoopItemAgain,
  setRunningLoopBudget,
  skipLoopItem,
} from "../../loop/loopSession.js";

/**
 * The loop's controls in the TUI inbox (`/loop`): Stop now, skip an item or
 * run it again, how often to re-plan, and the limits. The decisions and the
 * bounds are core's (skipItem, runItemAgain, setLoopBudget, through
 * loopSession.ts); this only lists them for the menu and words the result.
 */
export type LoopControlAction =
  | { kind: "stopNow" }
  | { kind: "skip"; itemId: string }
  | { kind: "again"; itemId: string }
  | { kind: "replan" }
  | { kind: "limits" };

/** The controls the menu offers for the loop as it is now. */
export function loopControlActions(
  loop: LoopState,
  plan: TaskPlan | undefined,
): LoopControlAction[] {
  const actions: LoopControlAction[] = [{ kind: "replan" }, { kind: "limits" }];
  for (const task of plan?.items ?? []) {
    const state = loop.items.find((i) => i.id === task.id);
    if (!state) continue;
    if (state.status === "done" || state.status === "failed") {
      actions.push({ kind: "again", itemId: task.id });
    }
    if (state.status !== "running" && state.status !== "done") {
      actions.push({ kind: "skip", itemId: task.id });
    }
  }
  if (loop.current) actions.push({ kind: "stopNow" });
  return actions;
}

function itemLabel(plan: TaskPlan | undefined, itemId: string): string {
  const text = plan?.items.find((i) => i.id === itemId)?.text;
  return text ? `${itemId}. ${text}` : itemId;
}

export function loopControlLabel(
  action: LoopControlAction,
  loop: LoopState,
  plan: TaskPlan | undefined,
): string {
  switch (action.kind) {
    case "stopNow":
      return "Stop now (the running item goes back to pending)";
    case "skip":
      return `Skip ${itemLabel(plan, action.itemId)}`;
    case "again":
      return `Run again: ${itemLabel(plan, action.itemId)}`;
    case "replan":
      return `${describeLoopReplan(loop)} (Enter to change)`;
    case "limits":
      return `Limits: ${describeLoopBudget(loop.budget)} (Enter to edit)`;
  }
}

/** Enter on the re-plan line: never, up to 1, 2, 3 times, until done. */
export function nextReplanSetting(loop: LoopState): LoopReplanSetting {
  const setting = loopReplanSetting(loop);
  switch (setting.kind) {
    case "never":
      return { kind: "up_to", replans: 1 };
    case "up_to":
      return setting.replans < 3
        ? { kind: "up_to", replans: setting.replans + 1 }
        : { kind: "until_done" };
    case "until_done":
      return { kind: "never" };
  }
}

/** The limits as the editor shows them: rounds, tokens, minutes. */
export function limitsDraft(loop: LoopState): string {
  const { maxRounds, maxTokens, maxWallMs } = loop.budget;
  return `${maxRounds} ${maxTokens} ${Math.round(maxWallMs / 60000)}`;
}

/**
 * The editor's text, "rounds tokens minutes" (0: no limit for tokens and
 * minutes), applied through core's setLoopBudget. Returns the feedback line.
 */
export function applyLimitsText(text: string): string {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 3) {
    return "Type three numbers: rounds, tokens and minutes (0: no limit).";
  }
  const [rounds, tokens, minutes] = parts.map(Number);
  const result = setRunningLoopBudget({
    maxRounds: rounds,
    maxTokens: tokens,
    maxWallMs: Math.round(minutes * 60000),
  });
  return result.ok
    ? `Limits: ${describeLoopBudget(result.loop.budget)}.`
    : result.error;
}

/**
 * Runs a control other than the limits editor, which the inbox opens itself.
 * `stopNow` aborts the running turn as Esc does (TUI's handleInterrupt).
 * Returns the feedback line.
 */
export function runLoopControl(
  action: Exclude<LoopControlAction, { kind: "limits" }>,
  loop: LoopState,
  onStopNow?: () => void,
): string {
  switch (action.kind) {
    case "stopNow":
      if (onStopNow) onStopNow();
      // Without a running turn to abort, the loop still stops
      interruptRunningLoop();
      return "Stopped. The item goes back to pending; Resume to go on.";
    case "skip": {
      const result = skipLoopItem(action.itemId);
      return result.ok ? `Skipped ${action.itemId}.` : result.error;
    }
    case "again": {
      const result = runLoopItemAgain(action.itemId);
      return result.ok ? `${action.itemId} runs again.` : result.error;
    }
    case "replan": {
      const result = setRunningLoopBudget({
        maxRounds: maxRoundsForReplan(loop, nextReplanSetting(loop)),
      });
      return result.ok ? `${describeLoopReplan(result.loop)}.` : result.error;
    }
  }
}
