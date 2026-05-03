/**
 * Detects whether a shell command's output tail looks like it is waiting for
 * interactive input (y/n confirmations, "Press any key", etc.).
 *
 * Ported from Marcel (src/tasks/LocalShellTask/LocalShellTask.tsx).
 * Used to surface stall notifications when background commands block on input.
 */

const PROMPT_PATTERNS: RegExp[] = [
  /\(y\/n\)/i, // (Y/n), (y/N)
  /\[y\/n\]/i, // [Y/n], [y/N]
  /\(yes\/no\)/i,
  /\b(?:Do you|Would you|Shall I|Are you sure|Ready to)\b.*\? *$/i,
  /Press (any key|Enter)/i,
  /Continue\?/i,
  /Overwrite\?/i,
  /Password:/i,
  /\bpassphrase\b/i,
];

/**
 * Returns true if the last line of `tail` looks like an interactive prompt
 * that a running command is blocked on.
 *
 * Use this to gate stall notifications so the model is only alerted when
 * there is something it can actually act on (a prompt to answer), not when a
 * command is merely slow.
 */
export function looksLikePrompt(tail: string): boolean {
  const lastLine = tail.trimEnd().split("\n").pop() ?? "";
  return PROMPT_PATTERNS.some((p) => p.test(lastLine));
}
