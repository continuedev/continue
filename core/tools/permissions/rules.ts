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

/** Glob match where `*` matches any run of characters except `/`, and `**` matches across `/`. */
export function globMatch(pattern: string, value: string): boolean {
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
  return new RegExp(re + "$").test(value);
}

/** MCP tool names are `mcp__<server>__<tool>`; a trailing `*` matches the rest. */
export function mcpNameMatch(pattern: string, toolName: string): boolean {
  return globMatch(pattern, toolName);
}

/** True when the command contains a construct the rule engine will not trust. */
export function hasUnsafeShellConstruct(command: string): boolean {
  // Command substitution, backticks, and process substitution.
  return /\$\(|`|<\(|>\(/.test(command);
}

/** Split a shell command into the parts a rule must match, on `&&`, `||`, `;`, `|` and newlines. */
export function splitCommandParts(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;|\||\n)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Terminal commands match on the whole command string, so a chained command
 * is only allowed when every part matches an allow rule. A deny rule on any
 * part refuses it. Substitution and unparsable input never match an allow rule.
 */
export function matchTerminalCommand(
  rules: ParsedRule[],
  command: string,
): RuleMatch | undefined {
  const toolRules = rules.filter((r) => r.toolName === "runTerminalCommand");
  const parts = splitCommandParts(command);

  for (const rule of toolRules) {
    if (rule.decision !== "deny") continue;
    if (rule.pattern === undefined) return { decision: "deny", rule };
    if (
      globMatch(rule.pattern, command) ||
      parts.some((p) => globMatch(rule.pattern!, p))
    ) {
      return { decision: "deny", rule };
    }
  }

  if (hasUnsafeShellConstruct(command) || parts.length === 0) return undefined;

  for (const rule of toolRules) {
    if (rule.decision !== "ask") continue;
    if (
      rule.pattern === undefined ||
      globMatch(rule.pattern, command) ||
      parts.some((p) => globMatch(rule.pattern!, p))
    ) {
      return { decision: "ask", rule };
    }
  }

  // Allow only when every part is covered by an allow rule.
  const allowRules = toolRules.filter((r) => r.decision === "allow");
  if (allowRules.length === 0) return undefined;
  const coveredBy = (part: string) =>
    allowRules.find(
      (r) => r.pattern === undefined || globMatch(r.pattern, part),
    );
  let firstRule: ParsedRule | undefined;
  for (const part of parts) {
    const hit = coveredBy(part);
    if (!hit) return undefined;
    firstRule ??= hit;
  }
  return firstRule ? { decision: "allow", rule: firstRule } : undefined;
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
