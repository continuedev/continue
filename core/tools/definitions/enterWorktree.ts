import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const enterWorktreeTool: Tool = {
  type: "function",
  displayTitle: "Enter Worktree",
  wouldLikeTo: "create a git worktree",
  isCurrently: "creating git worktree",
  hasAlready: "created git worktree",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.EnterWorktree,
    description: `Create an isolated git worktree and return its path.

Use this when you need to work on a task in an isolated branch without affecting
the current working tree. The worktree is a separate checkout of the same
repository at a new path.

After the tool returns:
- Use the returned \`worktreePath\` as the base path for all subsequent file
  operations in that task.
- Use ExitWorktree when done, either to keep the worktree for review or to
  remove it and clean up.

The tool will fail if you call it while already inside a worktree created by this
tool in the current session.`,
    parameters: {
      type: "object",
      required: [],
      properties: {
        name: {
          type: "string",
          description:
            "Optional slug for the worktree directory. Each path segment may contain only letters, digits, dots, underscores, and dashes; max 64 chars total. A timestamp-based name is used if omitted.",
        },
        branch: {
          type: "string",
          description:
            "Optional branch name to create in the worktree. Defaults to the worktree slug. If the branch already exists it will be checked out.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
