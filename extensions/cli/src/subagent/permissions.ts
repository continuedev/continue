import type { ToolPermissions } from "../permissions/types.js";

/**
 * The tool policies a subagent runs with.
 *
 * A subagent has no way to show a permission prompt, so tools the parent
 * would ask about are allowed for it (as before). What it must not do is
 * drop the parent's `exclude` policies: those come from `--exclude`, from
 * modes such as Plan (which excludes write tools) and from config, and a
 * subagent ignoring them could do exactly what the user ruled out.
 * Policies are first-match, so the excludes go ahead of the allow-all.
 */
export function subagentPermissions(parent: ToolPermissions): ToolPermissions {
  return {
    policies: [
      ...parent.policies.filter((p) => p.permission === "exclude"),
      { tool: "*", permission: "allow" },
    ],
  };
}
