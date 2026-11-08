import { ContextItem, Problem } from "..";

/** How long to wait for the language servers to report after an edit. */
export const PROBLEMS_WAIT_MS = 1500;
export const MAX_REPORTED = 20;

/** Problems the agent should hear about: errors and warnings. */
function reportable(p: Problem) {
  return !p.severity || p.severity === "error" || p.severity === "warning";
}

function key(p: Problem) {
  return `${p.severity ?? ""}\u0000${p.source ?? ""}\u0000${p.message}`;
}

/**
 * Problems in `after` that were not in `before`. Matched by severity, source
 * and message, not by line: an edit moves the lines below it, and a problem
 * that only moved is not new.
 */
export function newProblems(before: Problem[], after: Problem[]): Problem[] {
  const remaining = new Map<string, number>();
  for (const p of before)
    remaining.set(key(p), (remaining.get(key(p)) ?? 0) + 1);
  const added: Problem[] = [];
  for (const p of after) {
    const k = key(p);
    const n = remaining.get(k) ?? 0;
    if (n > 0) remaining.set(k, n - 1);
    else if (reportable(p)) added.push(p);
  }
  return added;
}

/** The context item telling the agent what its edit broke, or undefined. */
export function newProblemsItem(
  filepath: string,
  problems: Problem[],
): ContextItem | undefined {
  if (problems.length === 0) return undefined;
  const sorted = [...problems].sort(
    (a, b) =>
      Number(a.severity === "warning") - Number(b.severity === "warning") ||
      a.range.start.line - b.range.start.line,
  );
  const lines = sorted.slice(0, MAX_REPORTED).map((p) => {
    const source = p.source ? ` [${p.source}]` : "";
    return `- line ${p.range.start.line + 1}: ${p.severity ?? "problem"}${source}: ${p.message}`;
  });
  const more =
    problems.length > MAX_REPORTED
      ? `\n- (${problems.length - MAX_REPORTED} more)`
      : "";
  const errors = problems.filter((p) => p.severity !== "warning").length;
  return {
    icon: "problems",
    name: "New problems",
    description: `${problems.length} new problem${problems.length === 1 ? "" : "s"} after the edit`,
    content: `After this edit the editor reports ${problems.length} new problem${problems.length === 1 ? "" : "s"} in ${filepath}${errors ? ` (${errors} error${errors === 1 ? "" : "s"})` : ""}:\n${lines.join("\n")}${more}\n\nFix them if the edit caused them.`,
    hidden: false,
  };
}
