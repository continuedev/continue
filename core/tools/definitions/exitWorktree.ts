import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const exitWorktreeTool: Tool = {
  type: "function",
  displayTitle: "Exit Worktree",
  wouldLikeTo: "exit the git worktree",
  isCurrently: "exiting git worktree",
  hasAlready: "exited git worktree",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.ExitWorktree,
    description: `Exit a git worktree created by EnterWorktree.

- Use \`action: "keep"\` to preserve the worktree and its branch on disk for
  the user to review, merge, or continue later.
- Use \`action: "remove"\` to delete the worktree directory and its branch.
  This will be refused if there are uncommitted files or unmerged commits,
  unless you also pass \`discard_changes: true\` to acknowledge you want to
  discard them.

Important: this tool only operates on the worktree path you provide. It does
not automatically know which worktree is "active" — you must pass the exact
\`worktree_path\` returned by EnterWorktree.`,
    parameters: {
      type: "object",
      required: ["worktree_path", "action"],
      properties: {
        worktree_path: {
          type: "string",
          description: "Absolute path to the worktree (as returned by EnterWorktree).",
        },
        action: {
          type: "string",
          enum: ["keep", "remove"],
          description:
            '"keep" leaves the worktree and branch on disk. "remove" deletes both.',
        },
        discard_changes: {
          type: "boolean",
          description:
            "Set to true when action is \"remove\" and the worktree has uncommitted files or unmerged commits. The tool will refuse without this flag.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
