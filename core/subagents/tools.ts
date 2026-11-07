import type { Tool } from "..";
import { BuiltInToolNames, CLIENT_TOOLS_IMPLS } from "../tools/builtIn";
import { mcpServerSlug } from "../tools/mcpToolName";
import { canonicalRuleName } from "../tools/permissions/names";
import type { SubagentDefinition } from "./definitions";

/**
 * Tools that write the session's task list or plan. A subagent shares the
 * parent's session, so its own list would replace the parent's. Matched by
 * name, so a task-list tool added later under one of these names is covered.
 */
export const TASK_LIST_TOOL_NAMES = [
  "TaskList",
  "Checklist",
  "TodoWrite",
  "task_list",
  "update_task_list",
  "todo_write",
  // Writes the plan file and replaces the task list (Plan mode)
  "present_plan",
  "PresentPlan",
  "ExitPlanMode",
];

/**
 * Claude Code's tool names, so `.claude/agents` files mean the same here.
 * One name can stand for several tools (Read covers every read tool).
 */
const CLAUDE_TOOL_ALIASES: Record<string, string[]> = {
  read: [
    BuiltInToolNames.ReadFile,
    BuiltInToolNames.ReadFileRange,
    BuiltInToolNames.ReadCurrentlyOpenFile,
  ],
  grep: [BuiltInToolNames.GrepSearch],
  glob: [BuiltInToolNames.FileGlobSearch],
  ls: [BuiltInToolNames.LSTool, BuiltInToolNames.ViewSubdirectory],
  bash: [BuiltInToolNames.RunTerminalCommand],
  powershell: [BuiltInToolNames.RunTerminalCommand],
  edit: [
    BuiltInToolNames.EditExistingFile,
    BuiltInToolNames.SingleFindAndReplace,
  ],
  multiedit: [BuiltInToolNames.MultiEdit],
  write: [BuiltInToolNames.CreateNewFile],
  webfetch: [BuiltInToolNames.FetchUrlContent],
  websearch: [BuiltInToolNames.SearchWeb],
  skill: [BuiltInToolNames.ReadSkill],
};

/** Why a parent tool is not given to a subagent. */
export type SubagentToolExclusion =
  | "nesting" // the subagent tool itself: subagents cannot start subagents
  | "task-list" // would overwrite the parent's task list
  | "needs-diff-review" // edits applied through the parent's diff review UI
  | "not-allowed" // not in the definition's `tools`, or in `disallowedTools`
  | "not-available"; // the definition names it, but the parent does not have it

export interface ResolvedSubagentTools {
  tools: Tool[];
  excluded: { name: string; reason: SubagentToolExclusion }[];
  /** Entries in `tools` that matched none of the parent's tools. */
  unmatched: string[];
}

/** `Bash(git *)` → `Bash`: argument patterns are left to the parent's rules. */
function entryName(entry: string): string {
  const paren = entry.indexOf("(");
  return (paren >= 0 ? entry.slice(0, paren) : entry).trim();
}

/** Whether one `tools` entry names this tool. */
export function toolMatchesEntry(tool: Tool, rawEntry: string): boolean {
  const entry = entryName(rawEntry);
  if (!entry) return false;
  if (entry === "*") return true;
  const name = tool.function.name;
  const lower = entry.toLowerCase();
  if (name.toLowerCase() === lower) return true;
  if (canonicalRuleName(name).toLowerCase() === lower) return true;
  if (CLAUDE_TOOL_ALIASES[lower]?.includes(name)) return true;

  // Claude Code's MCP form: mcp__server, mcp__server__*, mcp__server__tool.
  const mcp = /^mcp__(.+?)(?:__(.+))?$/i.exec(entry);
  // MCP tools carry an mcp: uri, their server's name as the group and the
  // server's own tool name as originalFunctionName.
  if (mcp && tool.uri?.startsWith("mcp:")) {
    const server = mcpServerSlug(mcp[1]);
    const toolPart = mcp[2];
    if (server !== mcpServerSlug(tool.group)) return false;
    if (!toolPart || toolPart === "*") return true;
    return (
      tool.originalFunctionName?.toLowerCase() === toolPart.toLowerCase() ||
      name.toLowerCase() === `${server}_${toolPart}`.toLowerCase()
    );
  }
  return false;
}

/**
 * The tools a subagent runs with: the parent's active tools (already filtered
 * by mode, disabled tools and groups, so never more than the parent has),
 * narrowed by the definition's `tools` and `disallowedTools`, minus the ones a
 * subagent never gets. Whether a remaining call runs, asks or is refused is
 * still decided per call by the parent's policies.
 */
export function resolveSubagentTools(
  definition: Pick<SubagentDefinition, "tools" | "disallowedTools">,
  parentTools: Tool[],
): ResolvedSubagentTools {
  const tools: Tool[] = [];
  const excluded: ResolvedSubagentTools["excluded"] = [];
  const allow = definition.tools;
  const deny = definition.disallowedTools ?? [];

  for (const tool of parentTools) {
    const name = tool.function.name;
    let reason: SubagentToolExclusion | undefined;
    if (name === BuiltInToolNames.Subagent) {
      reason = "nesting";
    } else if (TASK_LIST_TOOL_NAMES.includes(name)) {
      reason = "task-list";
    } else if ((CLIENT_TOOLS_IMPLS as string[]).includes(name)) {
      // These edits are applied as a diff the person reviews in the parent's
      // chat, keyed to the parent's tool call; a subagent has no such call.
      reason = "needs-diff-review";
    } else if (allow && !allow.some((entry) => toolMatchesEntry(tool, entry))) {
      reason = "not-allowed";
    } else if (deny.some((entry) => toolMatchesEntry(tool, entry))) {
      reason = "not-allowed";
    }
    if (reason) {
      excluded.push({ name, reason });
    } else {
      tools.push(tool);
    }
  }

  const unmatched = (allow ?? []).filter(
    (entry) =>
      entryName(entry) !== "*" &&
      !parentTools.some((tool) => toolMatchesEntry(tool, entry)),
  );

  return { tools, excluded, unmatched };
}
