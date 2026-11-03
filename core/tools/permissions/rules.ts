/**
 * Tool permission rules from config.yaml `toolPermissions` (plans/tool-auto-approval.md, B1).
 *
 * Pure functions only: no I/O, no IDE calls. Wiring into `tools/evaluatePolicy`
 * and the GUI is B2. A rule is `toolName(pattern)` or a bare `toolName`.
 */

export type RuleDecision = "allow" | "ask" | "deny";

export interface ParsedRule {
  decision: RuleDecision;
  raw: string;
  toolName: string;
  /** undefined for a bare tool name, which matches any call to that tool */
  pattern?: string;
}

export interface ToolPermissions {
  allow?: string[];
  ask?: string[];
  deny?: string[];
}

export interface RuleMatch {
  decision: RuleDecision;
  rule: ParsedRule;
}

/** Parse `toolName(pattern)` or `toolName`. Returns undefined for malformed entries. */
export function parseRule(
  raw: string,
  decision: RuleDecision,
): ParsedRule | undefined {
  const trimmed = raw.trim();
  // Tool names may end in `*` for MCP name patterns (mcp__server__*).
  const m = trimmed.match(/^([A-Za-z_][\w.*-]*)(?:\((.*)\))?$/);
  if (!m) return undefined;
  const [, toolName, pattern] = m;
  if (pattern !== undefined && pattern.trim() === "") return undefined;
  return { decision, raw: trimmed, toolName, pattern };
}

export function parseToolPermissions(perms: ToolPermissions): ParsedRule[] {
  const out: ParsedRule[] = [];
  for (const [decision, list] of [
    ["allow", perms.allow ?? []],
    ["ask", perms.ask ?? []],
    ["deny", perms.deny ?? []],
  ] as const) {
    for (const raw of list) {
      const rule = parseRule(raw, decision);
      if (rule) out.push(rule);
    }
  }
  return out;
}

/**
 * Glob match where `*` matches any run of characters except `/`, and `**`
 * matches across `/`. Pass `ignoreCase` for file paths: Windows and macOS
 * volumes are case-insensitive, so `.ENV` is the same file as `.env` there and
 * a deny rule must not be bypassed by changing the case.
 */
export function globMatch(
  pattern: string,
  value: string,
  ignoreCase = false,
): boolean {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        // `**/` also matches zero directories, so `**/.env` matches `.env`.
        if (pattern[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(re + "$", ignoreCase ? "i" : "").test(value);
}

/** MCP tool names are `mcp__<server>__<tool>`; a trailing `*` matches the rest. */
export function mcpNameMatch(pattern: string, toolName: string): boolean {
  return globMatch(pattern, toolName);
}

import {
  commandGlobMatch,
  hasUnsafeShellConstruct,
  parseCommand,
  ruleCandidates,
} from "./command";

export { hasUnsafeShellConstruct, splitCommandParts } from "./command";

/**
 * Terminal commands are split into parts (quotes respected). A deny rule on
 * any part, or on anything `ruleCandidates` finds inside it, refuses the
 * command. Ask rules work the same way. An allow rule applies only when the
 * scanner fully understands the command (no substitution, no file redirect,
 * no unterminated quote) and every part is covered by an allow rule.
 *
 * Patterns use `*` for any run of characters, including `/`, because a
 * command is not a path (`terraform apply*` must match `terraform apply -var-file=a/b`).
 */
export function matchTerminalCommand(
  rules: ParsedRule[],
  command: string,
): RuleMatch | undefined {
  const toolRules = rules.filter((r) => r.toolName === "runTerminalCommand");
  const parsed = parseCommand(command);
  const candidatesPerPart = parsed.parts.map((p) => ruleCandidates(p));
  const hits = (rule: ParsedRule) =>
    rule.pattern === undefined ||
    [command, ...candidatesPerPart.flat()].some((c) =>
      commandGlobMatch(rule.pattern!, c),
    );

  for (const rule of toolRules) {
    if (rule.decision === "deny" && hits(rule))
      return { decision: "deny", rule };
  }
  for (const rule of toolRules) {
    if (rule.decision === "ask" && hits(rule)) return { decision: "ask", rule };
  }

  // Allow only what is fully understood.
  if (
    hasUnsafeShellConstruct(command) ||
    parsed.unparsable ||
    parsed.hasFileRedirect ||
    parsed.parts.length === 0
  ) {
    return undefined;
  }
  const allowRules = toolRules.filter((r) => r.decision === "allow");
  if (allowRules.length === 0) return undefined;
  let first: ParsedRule | undefined;
  for (const part of parsed.parts) {
    const hit = allowRules.find(
      (r) => r.pattern === undefined || commandGlobMatch(r.pattern, part),
    );
    if (!hit) return undefined;
    first ??= hit;
  }
  return first ? { decision: "allow", rule: first } : undefined;
}

/** Match a non-terminal tool call by name (and path, for file tools). */
export function matchToolCall(
  rules: ParsedRule[],
  toolName: string,
  target?: string,
): RuleMatch | undefined {
  const named = rules.filter((r) =>
    r.toolName.startsWith("mcp__") && toolName.startsWith("mcp__")
      ? mcpNameMatch(r.toolName, toolName)
      : r.toolName === toolName,
  );
  const matches = (r: ParsedRule) =>
    r.pattern === undefined ||
    (target !== undefined && globMatch(r.pattern, target));

  // Deny wins over ask, ask over allow, regardless of order.
  for (const decision of ["deny", "ask", "allow"] as const) {
    const hit = named.find((r) => r.decision === decision && matches(r));
    if (hit) return { decision, rule: hit };
  }
  return undefined;
}
