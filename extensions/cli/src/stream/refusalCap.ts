import { REFUSAL_CAP } from "core/util/turnEnd.js";

/**
 * Refusals in the current turn: rounds of tool calls in a row that only
 * refused, and the total refused. A refusal is a tool result the model reads
 * and carries on from, so it never ends the turn by itself; the cap does,
 * so that a model cannot spend a turn retrying around a rule
 * (plans/policy-areas.md, "Decision order"). Reset at the start of each
 * turn.
 */
let refusalsInARow = 0;
let refusalsThisTurn = 0;

export function resetRefusalCount(): void {
  refusalsInARow = 0;
  refusalsThisTurn = 0;
}

/**
 * Records one round of tool calls: how many were refused, and whether any
 * were. Returns true when the cap is reached (REFUSAL_CAP), which ends the
 * turn. A round with no refusal resets the run of refusals.
 */
export function recordRefusals(refused: number, anyRefused: boolean): boolean {
  if (!anyRefused) {
    refusalsInARow = 0;
    return false;
  }
  refusalsInARow += 1;
  refusalsThisTurn += Math.max(refused, 1);
  return (
    refusalsInARow >= REFUSAL_CAP.consecutive ||
    refusalsThisTurn >= REFUSAL_CAP.total
  );
}
