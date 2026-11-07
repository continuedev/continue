import type { ToolPermissions } from "../permissions/types.js";

import { SUBAGENT_TOOL_META } from "./index.js";

/**
 * The tool policies a subagent runs with: what the parent may do without
 * asking, and nothing more.
 *
 * A subagent has no way to show a permission prompt. Turning the parent's
 * "ask" into "allow" (as this used to) let a subagent edit files or run
 * commands the person had asked to approve, so "ask" becomes "exclude". The
 * parent's `exclude` policies stay (from `--exclude`, modes such as Plan, and
 * config), and anything no policy matches, which the parent would ask about,
 * is excluded too.
 *
 * Subagents cannot start subagents: the tool is excluded first, so a run
 * cannot recurse without bound.
 *
 * Policies are first-match, so the order of the parent's policies is kept.
 */
export function subagentPermissions(parent: ToolPermissions): ToolPermissions {
  return {
    policies: [
      { tool: SUBAGENT_TOOL_META.name, permission: "exclude" },
      ...parent.policies.map((p) =>
        p.permission === "ask" ? { ...p, permission: "exclude" as const } : p,
      ),
      { tool: "*", permission: "exclude" },
    ],
  };
}
