import type { ToolPolicy } from "@continuedev/terminal-security";
import * as posix from "node:path/posix";
import {
  canonicalRuleName,
  mcpRuleName,
  normalizeRelative,
  ruleTargetsFor,
} from "./names";
import {
  globMatch,
  matchTerminalCommand,
  ParsedRule,
  RuleDecision,
  RuleMatch,
} from "./rules";

/** Where a decision came from, so the UI can say why. */
export type DecisionSource =
  | "deny-rule"
  | "ask-rule"
  | "allow-rule"
  | "safety-floor"
  | "tool-setting"
  | "default";

export interface ToolDecision {
  policy: ToolPolicy;
  source: DecisionSource;
  /** One line a person can read, for the prompt or the refusal. */
  reason?: string;
  /** The rule that matched, as written in config.yaml. */
  rule?: string;
}

export interface DecideInput {
  toolName: string;
  /** Set for MCP tools: the server's display name and the tool's own name. */
  mcp?: { serverName: string; toolName: string };
  parsedArgs: Record<string, unknown>;
  /** Absolute path of a file tool's target, when the tool resolved one. */
  resolvedPath?: string;
  /** The user's setting for this tool. */
  base: ToolPolicy;
  /** The policy after the tool's own checks (safety floor, workspace). */
  evaluated: ToolPolicy;
  rules: ParsedRule[];
}

/** Resolve `.`/`..`, use forward slashes. A path that leaves the root keeps its `..`. */
function cleanPath(p: string): string {
  return posix.normalize(normalizeRelative(p) ?? "");
}

/** True for a path an allow rule may be matched against: relative, inside the root. */
function staysInside(p: string): boolean {
  return !(p === ".." || p.startsWith("../") || /^([a-zA-Z]:)?\//.test(p));
}

function findMatch(input: DecideInput): RuleMatch | undefined {
  const { toolName, mcp, parsedArgs, resolvedPath, rules } = input;
  if (rules.length === 0) return undefined;

  if (mcp) {
    return matchMcp(rules, mcpRuleName(mcp.serverName, mcp.toolName));
  }

  const names = new Set([canonicalRuleName(toolName), toolName]);
  const named = rules.filter((r) => names.has(r.toolName));
  if (named.length === 0) return undefined;

  if (canonicalRuleName(toolName) === "runTerminalCommand") {
    const command = ruleTargetsFor(toolName, parsedArgs)[0] ?? "";
    return matchTerminalCommand(
      named.map((r) => ({ ...r, toolName: "runTerminalCommand" })),
      command,
    );
  }

  const isPathTool = ["readFile", "writeFile", "listDirectory"].includes(
    canonicalRuleName(toolName),
  );
  const raw = ruleTargetsFor(toolName, parsedArgs);
  const targets = isPathTool
    ? [
        ...raw.map(cleanPath),
        ...(resolvedPath ? [cleanPath(resolvedPath)] : []),
      ]
    : raw;
  // Allow rules only ever see the path as written, and never one that leaves the root.
  const allowTarget = isPathTool
    ? raw.map(cleanPath).find(staysInside)
    : raw[0];

  const hit = (r: ParsedRule, ts: string[]) =>
    r.pattern === undefined || ts.some((t) => globMatch(r.pattern!, t));

  for (const decision of ["deny", "ask"] as RuleDecision[]) {
    const rule = named.find((r) => r.decision === decision && hit(r, targets));
    if (rule) return { decision, rule };
  }
  const allow = named.find(
    (r) =>
      r.decision === "allow" &&
      (r.pattern === undefined ||
        (allowTarget !== undefined && globMatch(r.pattern, allowTarget))),
  );
  return allow ? { decision: "allow", rule: allow } : undefined;
}

function matchMcp(rules: ParsedRule[], name: string): RuleMatch | undefined {
  const named = rules.filter(
    (r) => r.pattern === undefined && globMatch(r.toolName, name),
  );
  for (const decision of ["deny", "ask", "allow"] as RuleDecision[]) {
    const rule = named.find((r) => r.decision === decision);
    if (rule) return { decision, rule };
  }
  return undefined;
}

/**
 * Apply the user's rules on top of the tool's own policy, in this order:
 * deny rules; anything already `disabled` (a tool switched off or a command
 * the safety floor refuses); ask rules; allow rules; otherwise the evaluated
 * policy. Nothing after the first two steps can loosen them.
 */
export function decideToolCall(input: DecideInput): ToolDecision {
  const { base, evaluated } = input;
  const match = findMatch(input);

  if (match?.decision === "deny") {
    return {
      policy: "disabled",
      source: "deny-rule",
      rule: match.rule.raw,
      reason: `Blocked by your rule ${match.rule.raw} (toolPermissions.deny in config.yaml).`,
    };
  }
  if (evaluated === "disabled") {
    const off = base === "disabled";
    return {
      policy: "disabled",
      source: off ? "tool-setting" : "safety-floor",
      reason: off
        ? "This tool is turned off in your tool settings."
        : "This command is refused by the built-in safety check.",
    };
  }
  if (match?.decision === "ask") {
    return {
      policy: "allowedWithPermission",
      source: "ask-rule",
      rule: match.rule.raw,
      reason: `Your rule ${match.rule.raw} asks before running this.`,
    };
  }
  if (match?.decision === "allow") {
    return {
      policy: "allowedWithoutPermission",
      source: "allow-rule",
      rule: match.rule.raw,
      reason: `Allowed by your rule ${match.rule.raw}.`,
    };
  }
  return {
    policy: evaluated,
    source: evaluated === base ? "tool-setting" : "default",
  };
}
