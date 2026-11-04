import type { ToolPolicy } from "@continuedev/terminal-security";
import type { Loosening } from "./approval";
import { ProtectedHit, protectedReason } from "./protected";
import {
  canonicalRuleName,
  cleanPath,
  mcpRuleName,
  ruleTargetsFor,
  staysInside,
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
  | "protected-path"
  | "safety-floor"
  | "category"
  | "yolo"
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
  /** A protected path the call touches (see protected.ts); makes the call ask. */
  protectedHit?: ProtectedHit;
  /** What the approval mode or a category switch would allow (see approval.ts). */
  loosening?: Loosening;
}

export function findRuleMatch(input: DecideInput): RuleMatch | undefined {
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

  // Deny and ask ignore case for file paths: on Windows and macOS `.ENV` is
  // the same file as `.env`, and a protection must not be one keystroke away
  // from bypassed. Allow stays exact: loosening on a near-miss is the wrong
  // direction to be forgiving in.
  const hit = (r: ParsedRule, ts: string[]) =>
    r.pattern === undefined ||
    ts.some((t) => globMatch(r.pattern!, t, isPathTool));

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
 * the safety floor refuses); a protected path (always asks); ask rules; allow
 * rules; the approval mode or category switches; otherwise the evaluated policy. Nothing after the first two steps can
 * loosen them, and no allow rule can loosen a protected path.
 */
export function decideToolCall(input: DecideInput): ToolDecision {
  const { base, evaluated } = input;
  const match = findRuleMatch(input);

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
  if (input.protectedHit) {
    return {
      policy: "allowedWithPermission",
      source: "protected-path",
      reason: protectedReason(input.protectedHit),
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
  // An approval mode or switch only acts on a call nothing above has settled.
  if (input.loosening && evaluated === "allowedWithPermission") {
    return {
      policy: "allowedWithoutPermission",
      source: input.loosening.source,
      reason: input.loosening.reason,
    };
  }
  return {
    policy: evaluated,
    source: evaluated === base ? "tool-setting" : "default",
  };
}
