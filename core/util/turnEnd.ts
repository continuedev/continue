/**
 * The end-of-turn checks the harness makes so that a prompt's "carry on"
 * paragraphs can act (plans/policy-areas.md; policy-areas-prompts.md,
 * sections 4.5 and 8; policy-areas-test-findings.md). Each is one nudge,
 * never more: a small model that ends a turn by announcing its next step,
 * or ends a Loop run without its report, gets one short user message and
 * then the turn is over. Every harness that finishes work has a rule like
 * this (Cline's required finish tool, Claude Code's Stop hook with a cap,
 * Jules' "every response contains a tool call"); the prompt alone did not
 * hold on Nova 2 Lite, which stopped after "Let me check the existing
 * structure..." with no tool call.
 */

/**
 * Nudges in a row without a tool call in between: one. A nudge that leads to
 * tool calls has worked, and the budget starts again; a nudge that leads to
 * another announcement has not, and the turn ends. For a Loop run (one
 * report expected) this is also the total.
 */
export const TURN_NUDGE_LIMIT = 1;

/**
 * Nudges in one agent turn altogether, however many tool calls came between
 * them, so that a model that alternates one tool call with one announcement
 * cannot run on forever. Claude Code caps Stop-hook continuations at 8 with
 * a reset on tool use; on Nova 2 Lite one nudge was not enough and the
 * model wrote nothing in six turns (policy-areas-test-findings.md).
 */
export const TURN_NUDGE_TOTAL = 4;

/**
 * Refusals that end a turn as "needs you": this many in a row, or this many
 * in one turn. Claude Code pauses auto mode at 3 in a row or 20 in total.
 */
export const REFUSAL_CAP = { consecutive: 3, total: 20 } as const;

/** Phrases that announce an action rather than report one. */
const ANNOUNCES = [
  /\blet me\b/i,
  /\blet'?s\b/i,
  /\bi(?:'ll| will| am going to|'m going to)\b/i,
  /\b(?:next|now|first|then),? i\b/i,
  /\bi need to\b/i,
  /\bgoing to\b/i,
];

/** Phrases that report an outcome; a reply with one of these is a report, not an announcement. */
const REPORTS = [
  /\b(?:is|are|all|now) (?:done|complete|completed|finished|in place)\b/i,
  /\bsummary\b/i,
  /\bi (?:could not|couldn't|was not able to|was unable to|did not|didn't)\b/i,
  /\b(?:tests?|checks?) (?:pass|passed|fail|failed)\b/i,
  /^plan:/im,
];

/**
 * Whether a reply that ends a turn with no tool call announces a next step
 * instead of reporting. Only the last paragraph counts: that is where a
 * model says what it is about to do. A paragraph that reports an outcome is
 * never an announcement, so a real final report is not nudged.
 */
export function announcesNextStep(text: string): boolean {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = paragraphs.at(-1) ?? "";
  if (!last) return false;
  if (REPORTS.some((r) => r.test(last))) return false;
  if (/:\s*$/.test(last)) return true;
  return ANNOUNCES.some((r) => r.test(last));
}

/** The nudge for an agent turn that announced a step and stopped. */
export const ACT_TURN_NUDGE =
  "You named the next step and then stopped. Take it now: call the tool. If the request is done, say what you changed and what you ran; if you are blocked on something only the person has, say exactly what.";

/** The nudge for a Loop item run that ended without its report. */
export function finishItemNudge(finishItem: string): string {
  return `You ended without reporting. Call ${finishItem} now with the outcome and a one-line summary.`;
}

/** The nudge for a re-plan that ended without presenting a plan. */
export function presentPlanNudge(presentPlan: string): string {
  return `You ended without presenting the plan. Call ${presentPlan} now with the whole to-do list. Writing the call out as text does not count; the tool must be called.`;
}
