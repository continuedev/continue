import type { LoopAutonomy, LoopState, LoopStrategy } from "core/index.js";
import {
  formatLoopStatus,
  LOOP_AUTONOMY_LEVELS,
  setLoopBudget,
  LOOP_STRATEGY_ORDER,
  type LoopAnswerInput,
} from "core/util/loopMode.js";

import {
  acceptLoopPlan,
  answerLoopQuestion,
  getSessionLoop,
  requestLoopStop,
  resumeStoppedLoop,
  runLoopItemAgain,
  setRunningLoopAutonomy,
  setRunningLoopBudget,
  skipLoopItem,
  setRunningLoopStrategy,
  startLoopFromPlan,
} from "../loop/loopSession.js";

/**
 * Loop mode in `cn serve`: what `GET /state` adds, and the Loop mode fields
 * of `POST /message`:
 *
 * - `loopAnswer: {questionId?, itemId?, text, confirm?, approve?, replanNow?,
 *   standing?}` answers a question in the loop's inbox, or writes about an
 *   item or the plan. Core's answerLoop routes it by the item's state; an
 *   answer for the running item goes in at its next tool boundary, as
 *   `steer: true` does.
 * - `loopAction: "start" | "stop" | "resume" | "continue" | "skip" | "again"`
 *   are the inbox's buttons: build the session's plan in a loop (headless
 *   PresentPlan saves it without asking), Stop after this item, Resume,
 *   Continue the loop with a re-plan that waits for the person, Skip an item
 *   and Run it again. `skip` and `again` need `itemId` in the body; core's
 *   skipItem and runItemAgain refuse the running item. Stop now is
 *   `POST /pause`.
 * - `loopAutonomy: "supervised" | "auto" | "unattended" | "idgaf"` is the level picker;
 *   it resets the limits to the level's.
 * - `loopStrategy: "finish" | "check-in" | "fix-forward"` is the strategy
 *   picker; a picked strategy stays when the level changes.
 * - `loopBudget: {maxRounds?, maxTokens?, maxWallMs?, maxAttempts?,
 *   maxConsecutiveFailures?}` changes the limits while the loop runs, checked
 *   by core's setLoopBudget: maxRounds 1 is "never re-plan" and N + 1 is "up
 *   to N re-plans"; 0 means no limit for tokens and time. An out-of-range
 *   value is refused and nothing changes. It applies after `loopAutonomy`
 *   when both are given.
 */

/** Loop mode's fields in `GET /state`. */
export interface LoopSnapshot {
  /** The session's loop (core's LoopState), or null without one */
  loop: LoopState | null;
  /** One line for the loop's state, as the TUI shows it */
  loopStatus: string | null;
}

export function getLoopSnapshot(): LoopSnapshot {
  const loop = getSessionLoop();
  return {
    loop: loop ?? null,
    loopStatus: loop ? formatLoopStatus(loop) : null,
  };
}

const LOOP_ACTIONS = [
  "start",
  "stop",
  "resume",
  "continue",
  "skip",
  "again",
] as const;
type LoopAction = (typeof LOOP_ACTIONS)[number];

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseLoopAnswer(value: unknown): Parsed<LoopAnswerInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "loopAnswer must be an object" };
  }
  const v = value as Record<string, unknown>;
  const input: LoopAnswerInput = { text: "" };
  for (const key of ["questionId", "itemId", "text"] as const) {
    if (v[key] === undefined) continue;
    if (typeof v[key] !== "string") {
      return { ok: false, error: `loopAnswer.${key} must be a string` };
    }
    input[key] = v[key] as string;
  }
  for (const key of ["confirm", "approve", "replanNow", "standing"] as const) {
    if (v[key] === undefined) continue;
    if (typeof v[key] !== "boolean") {
      return { ok: false, error: `loopAnswer.${key} must be a boolean` };
    }
    input[key] = v[key] as boolean;
  }
  return { ok: true, value: input };
}

function applyLoopAction(
  action: LoopAction,
  itemId: unknown,
): string | undefined {
  switch (action) {
    case "start":
      return startLoopFromPlan()
        ? undefined
        : "The session has no plan to build in a loop";
    case "stop":
      if (!getSessionLoop()) return "No loop to stop";
      requestLoopStop();
      return undefined;
    case "resume":
      return resumeStoppedLoop() ? undefined : "No stopped loop to resume";
    case "continue":
      return acceptLoopPlan()
        ? undefined
        : "No re-planned plan waits to be accepted";
    case "skip":
    case "again": {
      if (typeof itemId !== "string" || !itemId) {
        return `loopAction "${action}" needs itemId`;
      }
      const result =
        action === "skip" ? skipLoopItem(itemId) : runLoopItemAgain(itemId);
      return result.ok ? undefined : result.error;
    }
  }
}

export interface LoopMessageResponse {
  status: number;
  json: Record<string, unknown>;
}

/**
 * POST /message with Loop mode fields. Returns undefined when the body has
 * none of them, so it is an ordinary message.
 */
export function handleLoopMessage(
  body: Record<string, unknown>,
): LoopMessageResponse | undefined {
  const {
    loopAnswer,
    loopAction,
    loopAutonomy,
    loopStrategy,
    loopBudget,
    itemId,
  } = body;
  if (
    loopAnswer === undefined &&
    loopAction === undefined &&
    loopAutonomy === undefined &&
    loopStrategy === undefined &&
    loopBudget === undefined
  ) {
    return undefined;
  }
  const fail = (error: string) => ({ status: 400, json: { error } });

  if (
    loopAction !== undefined &&
    !LOOP_ACTIONS.includes(loopAction as LoopAction)
  ) {
    return fail(`loopAction must be one of ${LOOP_ACTIONS.join(", ")}`);
  }
  if (
    loopAutonomy !== undefined &&
    !LOOP_AUTONOMY_LEVELS.includes(loopAutonomy as LoopAutonomy)
  ) {
    return fail(
      `loopAutonomy must be one of ${LOOP_AUTONOMY_LEVELS.join(", ")}`,
    );
  }
  if (
    loopStrategy !== undefined &&
    !LOOP_STRATEGY_ORDER.includes(loopStrategy as LoopStrategy)
  ) {
    return fail(
      `loopStrategy must be one of ${LOOP_STRATEGY_ORDER.join(", ")}`,
    );
  }
  const parsed =
    loopAnswer === undefined ? undefined : parseLoopAnswer(loopAnswer);
  if (parsed && !parsed.ok) return fail(parsed.error);
  // Bad limits are refused before anything else changes
  const loop = getSessionLoop();
  const checked =
    loopBudget !== undefined && loop
      ? setLoopBudget(loop, loopBudget)
      : undefined;
  if (checked && !checked.ok) return fail(checked.error);

  if (loopAction !== undefined) {
    const error = applyLoopAction(loopAction as LoopAction, itemId);
    if (error) return fail(error);
  }
  if (
    loopAutonomy !== undefined &&
    !setRunningLoopAutonomy(loopAutonomy as LoopAutonomy)
  ) {
    return fail("No loop in this session");
  }
  if (
    loopStrategy !== undefined &&
    !setRunningLoopStrategy(loopStrategy as LoopStrategy)
  ) {
    return fail("No loop in this session");
  }
  if (loopBudget !== undefined) {
    const budgeted = setRunningLoopBudget(loopBudget);
    if (!budgeted.ok) return fail(budgeted.error);
  }
  if (!parsed) {
    return { status: 200, json: { ...getLoopSnapshot() } };
  }
  const answered = answerLoopQuestion(parsed.value);
  if (!answered.ok) return fail(answered.error);
  return {
    status: 200,
    json: {
      answered: true,
      answerId: answered.answerId,
      route: answered.route,
      ...getLoopSnapshot(),
    },
  };
}
