import { loopCallKey } from "core/util/loopMode.js";

import { TASK_LIST_TOOL_NAME } from "../tools/taskList.js";

/**
 * Repeated tool calls in the current turn. Nothing in the stream loop used to
 * stop a model that issued the same call with the same arguments again and
 * again: GPT-OSS sent 24 and 67 identical TaskList calls, Nova Pro 107 in one
 * turn, Qwen3 Coder Next 42 rounds of the same two failing Reads, and Qwen3
 * 32B re-sent a call whose arguments failed validation 317 times
 * (research-bedrock-families.md item 3, research-qwen-harness.md). Only the
 * wall clock and the bill ended them.
 *
 * Two counts, both per turn and both with the refusal cap's shape
 * (refusalCap.ts): a call identical to the ones before it (same tool, same
 * arguments as canonical JSON) is refused without running from the third
 * repeat, and the turn ends at the sixth; a round of calls that fail argument
 * validation counts the same way, whatever the arguments, because a model
 * whose tool input arrives truncated sends a different broken call each time.
 * A different call resets the run of identical ones; a round with a valid call
 * resets the run of invalid ones.
 */
export const REPEAT_GUARD = { refuseAt: 3, endTurnAt: 6 } as const;

interface CallLike {
  name: string;
  arguments: Record<string, unknown> | undefined;
}

interface Repeat {
  /** Identical calls in a row, counting this one. */
  count: number;
  /** Every earlier identical call errored (or was not run). */
  errored: boolean;
}

/** The calls of the round before this one, by key. */
let previousRound = new Map<string, Repeat>();
/** The calls of the current round, by key. */
let currentRound = new Map<string, Repeat>();
/** Rounds in a row with a call that failed argument validation. */
let invalidRoundsInARow = 0;

export function resetRepeatGuard(): void {
  previousRound = new Map();
  currentRound = new Map();
  invalidRoundsInARow = 0;
}

/**
 * Starts a round (the tool calls of one model response). Only calls that
 * were also in the round before count on, so a call that comes back after
 * other work is a fresh call.
 */
export function startRepeatRound(): void {
  previousRound = currentRound;
  currentRound = new Map();
}

export interface RepeatVerdict {
  /** The tool result to return instead of running the call. */
  refusal?: string;
  /** The turn ends after this round. */
  endTurn: boolean;
}

function repeatKey(call: CallLike): string {
  return loopCallKey(call.name, call.arguments ?? {});
}

/**
 * Counts a call and says whether to refuse it. Call it for every call of a
 * round, in order, before anything runs.
 */
export function checkRepeatedCall(call: CallLike): RepeatVerdict {
  const key = repeatKey(call);
  const earlier = currentRound.get(key) ?? previousRound.get(key);
  const repeat: Repeat = {
    count: (earlier?.count ?? 0) + 1,
    errored: earlier?.errored ?? true,
  };
  currentRound.set(key, repeat);
  if (repeat.count < REPEAT_GUARD.refuseAt) {
    return { endTurn: false };
  }
  return {
    refusal: repeatedCallRefusal(call.name, repeat),
    endTurn: repeat.count >= REPEAT_GUARD.endTurnAt,
  };
}

/**
 * Records how a call of the current round went, so the refusal can say
 * whether the identical calls before it failed or succeeded.
 */
export function recordRepeatOutcome(call: CallLike, errored: boolean): void {
  const repeat = currentRound.get(repeatKey(call));
  if (repeat && !errored) {
    repeat.errored = false;
  }
}

/**
 * Records whether the round had a call that failed argument validation (a
 * missing required parameter, an unknown tool). Returns the verdict for the
 * round: a note to append to each such error from the third round in a row,
 * and whether the turn ends.
 */
export function recordInvalidCalls(anyInvalid: boolean): RepeatVerdict {
  if (!anyInvalid) {
    invalidRoundsInARow = 0;
    return { endTurn: false };
  }
  invalidRoundsInARow += 1;
  if (invalidRoundsInARow < REPEAT_GUARD.refuseAt) {
    return { endTurn: false };
  }
  return {
    refusal: `This is the ${ordinal(invalidRoundsInARow)} round in a row of tool calls with invalid arguments. Read the error, then send a complete call with every required parameter, or answer in text with what you have.`,
    endTurn: invalidRoundsInARow >= REPEAT_GUARD.endTurnAt,
  };
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${suffix}`;
}

/** What the model sees in place of a result when a call is refused for repeating. */
export function repeatedCallRefusal(toolName: string, repeat: Repeat): string {
  const earlier = repeat.count - 1;
  if (toolName === TASK_LIST_TOOL_NAME) {
    return `${toolName} was not run: the task list is already as you sent it, and it is sent to you with every request. Do not resend it unchanged. Call ${toolName} only to change an item's status or wording; otherwise go on with the work.`;
  }
  if (repeat.errored) {
    return `${toolName} was not run: this call already failed ${earlier} ${earlier === 1 ? "time" : "times"} with the same arguments, and the error is above. Read it and change something (the arguments, the tool, or the approach) before calling again.`;
  }
  return `${toolName} was not run: it is identical to the last ${earlier} ${earlier === 1 ? "call" : "calls"}, whose result is above. Use that result or change the arguments; do not repeat the call unchanged.`;
}
