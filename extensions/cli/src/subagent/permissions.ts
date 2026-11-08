import type { ToolPermissions } from "../permissions/types.js";

import { SUBAGENT_TOOL_META } from "./index.js";

export interface SubagentPermissionOptions {
  /**
   * Whether the subagent's "ask" calls can reach a person: the parent's
   * permission prompt is available and the session is not headless.
   */
  canPrompt?: boolean;
}

/**
 * The tool policies a subagent runs with: never more than the parent has.
 *
 * When the parent's permission prompt can be reached, "ask" stays "ask" and
 * the subagent's calls go to that prompt, labelled with the subagent's name.
 * When it cannot (headless, `serve`, or no prompt wired), "ask" becomes
 * "exclude": turning it into "allow" (as this once did) let a subagent edit
 * files or run commands the person had asked to approve. Anything no policy
 * matches, which the parent would ask about, is treated the same way.
 *
 * The parent's `exclude` policies always stay (from `--exclude`, modes such
 * as Plan, and config).
 *
 * Subagents cannot start subagents: the tool is excluded first, so a run
 * cannot recurse without bound.
 *
 * Policies are first-match, so the order of the parent's policies is kept.
 */
/**
 * Tools that write the session's task list (TaskList, and its alias), and
 * Loop mode's tools, which hold questions for and report the parent's item
 */
export const TASK_LIST_TOOLS = [
  "TaskList",
  "Checklist",
  "HoldQuestion",
  "FinishItem",
  "RemindMe",
];

export function subagentPermissions(
  parent: ToolPermissions,
  { canPrompt = false }: SubagentPermissionOptions = {},
): ToolPermissions {
  const unmatched = canPrompt ? ("ask" as const) : ("exclude" as const);
  return {
    policies: [
      { tool: SUBAGENT_TOOL_META.name, permission: "exclude" },
      // The task list belongs to the parent's session, which a subagent
      // shares: its own list would replace the parent's.
      ...TASK_LIST_TOOLS.map((tool) => ({
        tool,
        permission: "exclude" as const,
      })),
      ...parent.policies.map((p) =>
        p.permission === "ask" && !canPrompt
          ? { ...p, permission: "exclude" as const }
          : p,
      ),
      { tool: "*", permission: unmatched },
    ],
  };
}
