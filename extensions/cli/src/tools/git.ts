import { execFile } from "child_process";
import { promisify } from "util";

import { Tool } from "./types.js";

const execFileAsync = promisify(execFile);
const SUPPORTED_GIT_ACTIONS = [
  "status",
  "diff",
  "log",
  "branch",
  "remote",
] as const;
type GitAction = (typeof SUPPORTED_GIT_ACTIONS)[number];

const SAFE_GIT_ACTIONS: Record<GitAction, string[]> = {
  status: ["status", "--short", "--branch"],
  diff: ["diff", "--stat"],
  log: ["log", "--oneline", "-n", "20"],
  branch: ["branch", "--show-current"],
  remote: ["remote", "-v"],
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

export const gitTool: Tool = {
  name: "Git",
  displayName: "Git",
  description:
    "Inspect repository state with a safe subset of git commands such as status, diff, log, branch, and remote.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        description: "One of status, diff, log, branch, or remote.",
        enum: [...SUPPORTED_GIT_ACTIONS],
      },
    },
  },
  run: async (args: { action: string }): Promise<string> => {
    const rawAction = typeof args.action === "string" ? args.action.trim() : "";
    const action = rawAction.toLowerCase();

    if (!isGitAction(action)) {
      return `Unsupported git action: ${rawAction || "(empty)"}. Supported actions: ${SUPPORTED_GIT_ACTIONS.join(", ")}.`;
    }

    const gitArgs = SAFE_GIT_ACTIONS[action];

    try {
      const { stdout, stderr } = await execFileAsync("git", gitArgs, {
        cwd: process.cwd(),
        maxBuffer: 2 * 1024 * 1024,
      });
      return formatGitOutput(action, stdout.trim() || stderr.trim());
    } catch (error: any) {
      const stderr =
        typeof error?.stderr === "string" ? error.stderr.trim() : "";
      const message =
        stderr ||
        (error instanceof Error && error.message ? error.message.trim() : "");
      return message
        ? `Git ${action} failed: ${message}`
        : `Git ${action} failed.`;
    }
  },
};
