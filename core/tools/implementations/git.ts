import { ToolExtras } from "../..";
import { ToolImpl } from ".";

const SUPPORTED_GIT_ACTIONS = [
  "status",
  "diff",
  "log",
  "branch",
  "remote",
] as const;

type GitAction = (typeof SUPPORTED_GIT_ACTIONS)[number];

const SAFE_GIT_ACTIONS: Record<GitAction, string> = {
  status: "git status --short --branch",
  diff: "git diff --stat",
  log: "git log --oneline -n 20",
  branch: "git branch --show-current",
  remote: "git remote -v",
};

function isGitAction(action: string): action is GitAction {
  return SUPPORTED_GIT_ACTIONS.includes(action as GitAction);
}

function formatGitOutput(action: GitAction, output: string): string {
  switch (action) {
    case "status":
      return output
        ? `Git status:\n${output}`
        : "Git status: working tree clean.";
    case "diff":
      return output
        ? `Git diff summary:\n${output}`
        : "Git diff summary: no changes.";
    case "log":
      return output
        ? `Recent commits:\n${output}`
        : "Recent commits: unavailable.";
    case "branch":
      return output
        ? `Current branch: ${output}`
        : "Current branch: unavailable.";
    case "remote":
      return output
        ? `Git remotes:\n${output}`
        : "Git remotes: none configured.";
  }
}

async function getWorkspaceDir(extras: ToolExtras): Promise<string> {
  const workspaceDirs = await extras.ide.getWorkspaceDirs();
  if (workspaceDirs.length === 0) {
    throw new Error("No workspace directory found.");
  }
  return workspaceDirs[0];
}

export const gitToolImpl: ToolImpl = async (args, extras) => {
  const rawAction = typeof args?.action === "string" ? args.action.trim() : "";
  const action = rawAction.toLowerCase();

  if (!isGitAction(action)) {
    throw new Error(
      `Unsupported git action: ${rawAction || "(empty)"}. Supported actions: ${SUPPORTED_GIT_ACTIONS.join(", ")}.`,
    );
  }

  const workspaceDir = await getWorkspaceDir(extras);
  const [stdout, stderr] = await extras.ide.subprocess(
    SAFE_GIT_ACTIONS[action],
    workspaceDir,
  );
  const content = formatGitOutput(action, stdout.trim() || stderr.trim());

  return [
    {
      name: "Git",
      description: `${action} for current repository`,
      content,
    },
  ];
};
