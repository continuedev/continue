import { BuiltInToolNames } from "../builtIn";
import { parseCommand } from "./command";
import { findProtected } from "./protectedCall";
import {
  canonicalRuleName,
  cleanPath,
  mcpRuleName,
  ruleTargetsFor,
  staysInside,
} from "./names";

/**
 * The rule "Always allow" would write for a pending tool call, or why there is
 * none. The rule is deliberately as narrow as the call, never a guess at what
 * the user "really meant":
 *
 * - Terminal: only the command the user was shown. The exact command, with
 *   glob characters escaped. `npm test` allows `npm test`, not `npm test*`.
 *   A command we cannot fully parse, or that has a redirect or substitution,
 *   gets no rule, because an allow rule would never apply to it anyway.
 * - Files: only that one path (relative to the project, no `../`).
 * - MCP: the one tool, `mcp__server__tool`. Never the whole server.
 * - Anything else: the bare tool name only for tools that cannot change
 *   anything (read-only searches). Never for edits, URLs or unknown tools.
 */
export type SuggestedRule =
  | {
      ok: true;
      rule: string;
      summary: string;
      /**
       * True when the tool's own safety check would still ask for this call,
       * so saving the rule switches that check off for it. The caller that has
       * the tool sets this; `suggestAllowRule` alone cannot know. The UI shows
       * the exact rule and asks for a second yes.
       */
      loosensCheck?: boolean;
    }
  | { ok: false; reason: string };

export interface SuggestInput {
  toolName: string;
  parsedArgs: Record<string, unknown>;
  mcp?: { serverName: string; toolName: string };
  readonly?: boolean;
}

/**
 * Rule patterns have no escape for `*` and `?`, so a command or path that
 * contains one cannot be written as an exact rule: it would match more than
 * the user approved. Those get no rule.
 */
function hasGlobChars(text: string): boolean {
  return /[*?]/.test(text);
}

/**
 * Add `loosensCheck` to a rule suggestion: would the tool's own safety check
 * still ask for this call? If so, saving the rule switches that check off for
 * it, and the user should see exactly what they are saving and say yes again.
 * The tool is asked as if the user's own setting were "allow", so the answer
 * reflects the tool's judgement and not the current setting.
 */
export function withLoosensCheck(
  suggestion: SuggestedRule,
  tool:
    | {
        evaluateToolCallPolicy?: (
          base: "allowedWithoutPermission",
          args: Record<string, unknown>,
          processed?: Record<string, unknown>,
        ) => string;
      }
    | undefined,
  parsedArgs: Record<string, unknown>,
): SuggestedRule {
  if (!suggestion.ok) return suggestion;
  let asks = false;
  try {
    asks =
      tool?.evaluateToolCallPolicy?.(
        "allowedWithoutPermission",
        parsedArgs,
        undefined,
      ) === "allowedWithPermission";
  } catch {
    // If the tool's check cannot run, assume it would have asked: the safe side.
    asks = true;
  }
  return { ...suggestion, loosensCheck: asks };
}

export function suggestAllowRule(input: SuggestInput): SuggestedRule {
  const { toolName, parsedArgs, mcp } = input;

  // A protected path always asks, and no allow rule can change that. Saving
  // one would look like it worked and then ask again, so say so up front.
  const protectedHit = findProtected({ toolName, parsedArgs });
  if (protectedHit) {
    return {
      ok: false,
      reason: `${protectedHit.path} is a protected path, so it always asks first and cannot be always-allowed.`,
    };
  }

  if (mcp) {
    const rule = mcpRuleName(mcp.serverName, mcp.toolName);
    return { ok: true, rule, summary: `this tool (${rule})` };
  }

  const name = canonicalRuleName(toolName);

  if (toolName === BuiltInToolNames.RunTerminalCommand) {
    const command = String(parsedArgs.command ?? "").trim();
    if (!command) return { ok: false, reason: "There is no command to allow." };
    const parsed = parseCommand(command);
    if (
      parsed.unparsable ||
      parsed.hasFileRedirect ||
      /\$\(|`|<\(|>\(/.test(command)
    ) {
      return {
        ok: false,
        reason:
          "This command uses a redirect, substitution or unusual quoting, so a rule could not safely allow it.",
      };
    }
    if (command.includes("\n")) {
      return {
        ok: false,
        reason: "A multi-line command cannot be saved as a rule.",
      };
    }
    // Allow rules are checked one part at a time, so a rule holding a whole
    // chain (`a && b`) would never match anything. Say so instead of saving it.
    if (parsed.parts.length > 1) {
      return {
        ok: false,
        reason:
          "This command chains several commands (&&, ;, | or &). Allow the parts one at a time instead.",
      };
    }
    // A rule is `name(pattern)`: a `)` would end it early.
    if (command.includes(")")) {
      return {
        ok: false,
        reason: "A command containing ) cannot be saved as a rule.",
      };
    }
    if (hasGlobChars(command)) {
      return {
        ok: false,
        reason:
          "A command containing * or ? cannot be saved as an exact rule, because rules treat those as wildcards.",
      };
    }
    return {
      ok: true,
      rule: `runTerminalCommand(${command})`,
      summary: `this exact command`,
    };
  }

  if (["readFile", "writeFile", "listDirectory"].includes(name)) {
    if (name === "writeFile") {
      return {
        ok: false,
        reason:
          "File edits are already reviewed as a diff, so there is nothing to always allow.",
      };
    }
    const target = ruleTargetsFor(toolName, parsedArgs)[0];
    const path = target ? cleanPath(target) : undefined;
    if (
      !path ||
      !staysInside(path) ||
      path.includes(")") ||
      hasGlobChars(path)
    ) {
      return {
        ok: false,
        reason:
          "Only plain paths inside the project can be allowed, and this one is not.",
      };
    }
    return {
      ok: true,
      rule: `${name}(${path})`,
      summary: `this path (${path})`,
    };
  }

  if (input.readonly && ["grepSearch", "globSearch"].includes(name)) {
    return { ok: true, rule: name, summary: `all ${name} calls` };
  }

  return {
    ok: false,
    reason: "This kind of call cannot be saved as an always-allow rule.",
  };
}
