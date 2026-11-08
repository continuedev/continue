import type { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";
import { canonicalRuleName } from "./names";

/**
 * How much the user lets tools run without asking (plan section 4).
 *
 * - manual: today's behaviour; only the user's rules loosen anything.
 * - autoApprove: the category switches below also loosen calls.
 * - auto: autoApprove, and a reviewer model decides what is left.
 * - review: every call that is not refused, protected, or asked about by a rule
 *   is allowed.
 * - yolo: every call is allowed, whatever a rule, a protected path or the
 *   safety floor says. Only a tool switched off stays off.
 *
 * Apart from yolo, none of these can loosen a deny rule, a tool that is switched off, a command
 * the safety floor refuses, a protected path, or an ask rule. They only act on
 * a call that would otherwise be left to the user's tool setting.
 */
export type ApprovalModeName =
  "manual" | "autoApprove" | "auto" | "review" | "yolo";

export const APPROVAL_MODES: readonly ApprovalModeName[] = [
  "manual",
  "autoApprove",
  "auto",
  "review",
  "yolo",
];

/** The switches of the Auto-approve card. Anything absent is off. */
export interface ApprovalCategories {
  /** Read, list and search inside the workspace. */
  readFiles?: boolean;
  /** Edit tools. */
  editFiles?: boolean;
  /** Commands the safety floor marks as safe. */
  runSafeCommands?: boolean;
  /** Every command the floor does not refuse. Includes the safe ones. */
  runAllCommands?: boolean;
  /** Web search and URL fetch. */
  browser?: boolean;
  /** MCP tools of every server without a switch of its own. */
  mcp?: boolean;
}

export type ApprovalCategoryName = keyof ApprovalCategories;

export interface ApprovalSettings {
  mode: ApprovalModeName;
  categories?: ApprovalCategories;
  /** Per-server switch, keyed by the server's display name. Wins over `categories.mcp`. */
  mcpServers?: Record<string, boolean>;
}

export const CATEGORY_LABELS: Record<ApprovalCategoryName, string> = {
  readFiles: "Read files",
  editFiles: "Edit files",
  runSafeCommands: "Run safe commands",
  runAllCommands: "Run all commands",
  browser: "Browser",
  mcp: "MCP servers",
};

/** What a mode or switch decided, for the decision chip. */
export interface Loosening {
  source: "category" | "review" | "yolo";
  reason: string;
  /** Allows the call whatever else applies (YOLO). */
  absolute?: boolean;
}

type ToolLike = Pick<
  Tool,
  "group" | "originalFunctionName" | "uri" | "evaluateToolCallPolicy"
>;

const READ_NAMES = new Set<string>([
  "readFile",
  "listDirectory",
  "grepSearch",
  "globSearch",
  BuiltInToolNames.ViewDiff,
  BuiltInToolNames.CodebaseTool,
  BuiltInToolNames.ViewRepoMap,
  BuiltInToolNames.ReadSkill,
]);
const BROWSER_NAMES = new Set(["fetchUrl", "searchWeb"]);

/** Which switch governs a tool, or undefined when none does (it then keeps asking). */
export function categoryOfTool(
  toolName: string,
  tool: Pick<Tool, "uri"> | undefined,
): ApprovalCategoryName | undefined {
  if (tool?.uri?.startsWith("mcp:")) return "mcp";
  const name = canonicalRuleName(toolName);
  if (name === "runTerminalCommand") return "runSafeCommands";
  if (name === "writeFile") return "editFiles";
  if (READ_NAMES.has(name)) return "readFiles";
  if (BROWSER_NAMES.has(name)) return "browser";
  return undefined;
}

/**
 * Would the tool's own check pass if the user had set it to run without
 * asking? That is false for a file outside the workspace and for a command the
 * safety floor does not call safe, so a switch never reaches past them.
 */
function passesOwnCheck(
  tool: ToolLike | undefined,
  parsedArgs: Record<string, unknown>,
  processedArgs: Record<string, unknown> | undefined,
): boolean {
  if (!tool?.evaluateToolCallPolicy) return true;
  return (
    tool.evaluateToolCallPolicy(
      "allowedWithoutPermission",
      parsedArgs,
      processedArgs,
    ) === "allowedWithoutPermission"
  );
}

export interface LooseningInput {
  approval: ApprovalSettings | undefined;
  tool: ToolLike | undefined;
  toolName: string;
  parsedArgs: Record<string, unknown>;
  processedArgs?: Record<string, unknown>;
}

/**
 * Whether the approval mode and switches allow this call without asking. The
 * caller applies the result only to a call that is still open (no rule matched,
 * not protected, not refused), which is what keeps the order of plan section 5.
 */
export function approvalLoosening(
  input: LooseningInput,
): Loosening | undefined {
  const { approval, tool, toolName, parsedArgs, processedArgs } = input;
  if (!approval || !APPROVAL_MODES.includes(approval.mode)) return undefined;
  if (approval.mode === "manual") return undefined;

  if (approval.mode === "yolo") {
    return { source: "yolo", reason: "Allowed by YOLO mode.", absolute: true };
  }

  if (approval.mode === "review") {
    return {
      source: "review",
      reason:
        "Allowed by Review mode (no deny rule or protected path applies).",
    };
  }

  const category = categoryOfTool(toolName, tool);
  if (!category) return undefined;
  const on = approval.categories ?? {};

  if (category === "mcp") {
    const server = tool?.group;
    const own =
      server !== undefined ? approval.mcpServers?.[server] : undefined;
    const allowed = own ?? on.mcp === true;
    return allowed
      ? {
          source: "category",
          reason:
            own !== undefined
              ? `Allowed by your switch for the ${server} MCP server.`
              : `Allowed by the "${CATEGORY_LABELS.mcp}" switch.`,
        }
      : undefined;
  }

  if (category === "runSafeCommands") {
    if (on.runAllCommands) {
      return {
        source: "category",
        reason: `Allowed by the "${CATEGORY_LABELS.runAllCommands}" switch.`,
      };
    }
    if (on.runSafeCommands && passesOwnCheck(tool, parsedArgs, processedArgs)) {
      return {
        source: "category",
        reason: `Allowed by the "${CATEGORY_LABELS.runSafeCommands}" switch (the safety check calls it safe).`,
      };
    }
    return undefined;
  }

  if (on[category] && passesOwnCheck(tool, parsedArgs, processedArgs)) {
    return {
      source: "category",
      reason: `Allowed by the "${CATEGORY_LABELS[category]}" switch.`,
    };
  }
  return undefined;
}
