import type { ToolPolicy } from "@continuedev/terminal-security";
import type { Tool } from "../..";
import type { ResolvedPath } from "../../util/pathResolver";
import { DecisionSource, decideToolCall } from "./decide";
import { parsePermissions, uriToPath } from "./names";
import type { ToolPermissions } from "./rules";

export interface ToolPolicyResult {
  policy: ToolPolicy;
  displayValue?: string;
  /** Present only when the user has rules, so existing callers see no change. */
  source?: DecisionSource;
  /** A sentence a person can read, for the prompt or the refusal. */
  reason?: string;
  /** The rule that decided, as written in config.yaml. */
  rule?: string;
}

export interface EvaluateInput {
  tool:
    | Pick<
        Tool,
        "group" | "originalFunctionName" | "uri" | "evaluateToolCallPolicy"
      >
    | undefined;
  toolName: string;
  basePolicy: ToolPolicy;
  parsedArgs: Record<string, unknown>;
  processedArgs?: Record<string, unknown>;
  permissions: ToolPermissions | undefined;
}

/**
 * The policy for one tool call: the tool's own check first (command safety
 * floor, workspace-only reads), then the user's `toolPermissions` rules on top.
 * Without rules this returns exactly what it did before rules existed.
 */
export function evaluateToolPolicyWithRules(
  input: EvaluateInput,
): ToolPolicyResult {
  const { tool, toolName, basePolicy, parsedArgs, processedArgs } = input;

  // A tool we do not know has nothing to check, as before.
  if (!tool) return { policy: basePolicy };

  // The command, so a refusal can show what was refused. (This used to compare
  // against "runTerminalCommand", which is never the tool's real name, so the
  // command was never shown.)
  let displayValue: string | undefined;
  if (toolName === "run_terminal_command" && parsedArgs.command) {
    displayValue = parsedArgs.command as string;
  }

  const evaluated = tool.evaluateToolCallPolicy
    ? tool.evaluateToolCallPolicy(basePolicy, parsedArgs, processedArgs)
    : basePolicy;

  const rules = parsePermissions(input.permissions);
  if (rules.length === 0) return { policy: evaluated, displayValue };

  const resolved = processedArgs?.resolvedPath as
    ResolvedPath | null | undefined;
  const isMcp = !!tool.uri?.startsWith("mcp:") && !!tool.originalFunctionName;

  const decision = decideToolCall({
    toolName,
    mcp: isMcp
      ? { serverName: tool.group, toolName: tool.originalFunctionName! }
      : undefined,
    parsedArgs,
    resolvedPath: resolved ? uriToPath(resolved.uri) : undefined,
    base: basePolicy,
    evaluated,
    rules,
  });

  return {
    policy: decision.policy,
    displayValue,
    source: decision.source,
    ...(decision.reason ? { reason: decision.reason } : {}),
    ...(decision.rule ? { rule: decision.rule } : {}),
  };
}
