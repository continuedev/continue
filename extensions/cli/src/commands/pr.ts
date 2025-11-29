import { execFile } from "child_process";
import { promisify } from "util";

import { getGitBranch, getGitRemoteUrl, isGitRepo } from "../util/git.js";
import { logger } from "../util/logger.js";

const execFileAsync = promisify(execFile);

export interface PrOptions {
  title?: string;
  body?: string;
  base?: string;
  draft?: boolean;
  web?: boolean;
}

export interface PrResult {
  success: boolean;
  message: string;
  error?: string;
  prUrl?: string;
}

/**
 * Check if GitHub CLI is installed
 */
async function isGhInstalled(): Promise<boolean> {
  try {
    await execFileAsync("gh", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse GitHub repository owner and name from remote URL
 */
function parseGitHubRepo(remoteUrl: string): {
  owner: string;
  repo: string;
} | null {
  // Handle various GitHub URL formats:
  // - https://github.com/owner/repo.git
  // - git@github.com:owner/repo.git
  // - https://github.com/owner/repo
  // - git@github.com:owner/repo

  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);

  if (!match) {
    return null;
  }

  const [, owner, repo] = match;
  return { owner, repo: repo.replace(/\.git$/, "") };
}

/**
 * Create a pull request using GitHub CLI
 */
async function createPrWithGh(options: PrOptions): Promise<{ prUrl?: string }> {
  const args = ["pr", "create"];

  if (options.title) {
    args.push("--title", options.title);
  }

  if (options.body) {
    args.push("--body", options.body);
  }

  if (options.base) {
    args.push("--base", options.base);
  }

  if (options.draft) {
    args.push("--draft");
  }

  if (options.web) {
    args.push("--web");
  } else {
    // Fill in title and body interactively if not provided
    if (!options.title || !options.body) {
      args.push("--fill");
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync("gh", args, {
      cwd: process.cwd(),
    });

    if (stderr && !stderr.includes("Creating pull request")) {
      logger.warn(`GitHub CLI stderr: ${stderr}`);
    }

    // Extract PR URL from output (gh outputs the URL on success)
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
    const prUrl = urlMatch ? urlMatch[0] : undefined;

    logger.info(`GitHub CLI output: ${stdout}`);

    return { prUrl };
  } catch (error: any) {
    throw new Error(`Failed to create pull request: ${error.message}`);
  }
}

/**
 * Get commit messages for the current branch
 */
async function getCommitMessages(base: string = "main"): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", `${base}..HEAD`, "--pretty=format:- %s"],
      {
        cwd: process.cwd(),
      },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

/**
 * Generate a default PR title from the branch name
 */
function getTitleFromBranch(branch: string): string {
  // Convert branch name to a readable title
  // e.g., "feature/add-new-endpoint" -> "Add new endpoint"
  return branch
    .replace(/^(feature|fix|bugfix|hotfix|chore|docs|refactor|test)\//i, "")
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Validate git repository and branch requirements
 */
function validateGitEnvironment(): {
  currentBranch: string;
  remoteUrl: string;
  repoInfo: { owner: string; repo: string };
  error?: string;
} {
  // Check if we're in a git repository
  if (!isGitRepo()) {
    return {
      currentBranch: "",
      remoteUrl: "",
      repoInfo: { owner: "", repo: "" },
      error:
        "Not in a git repository. Please run this command from a git repository.",
    };
  }

  // Get current branch
  const currentBranch = getGitBranch();
  if (!currentBranch) {
    return {
      currentBranch: "",
      remoteUrl: "",
      repoInfo: { owner: "", repo: "" },
      error: "Could not determine current branch.",
    };
  }

  // Check if we're on main/master branch
  const baseBranches = ["main", "master"];
  if (baseBranches.includes(currentBranch)) {
    return {
      currentBranch,
      remoteUrl: "",
      repoInfo: { owner: "", repo: "" },
      error: `You're currently on the ${currentBranch} branch. Please create a feature branch first.`,
    };
  }

  // Get remote URL
  const remoteUrl = getGitRemoteUrl();
  if (!remoteUrl) {
    return {
      currentBranch,
      remoteUrl: "",
      repoInfo: { owner: "", repo: "" },
      error:
        "Could not find git remote URL. Make sure you have a remote configured.",
    };
  }

  // Verify it's a GitHub repository
  const repoInfo = parseGitHubRepo(remoteUrl);
  if (!repoInfo) {
    return {
      currentBranch,
      remoteUrl,
      repoInfo: { owner: "", repo: "" },
      error:
        "This doesn't appear to be a GitHub repository. Pull request creation is only supported for GitHub repositories.",
    };
  }

  return { currentBranch, remoteUrl, repoInfo };
}

/**
 * Check GitHub CLI installation
 */
async function ensureGitHubCliInstalled(): Promise<{
  installed: boolean;
  error?: string;
}> {
  const ghInstalled = await isGhInstalled();

  if (!ghInstalled) {
    return {
      installed: false,
      error:
        "GitHub CLI (gh) is not installed. Please install it to create pull requests.\n" +
        "To install:\n" +
        "  macOS: brew install gh\n" +
        "  Linux: https://github.com/cli/cli#installation\n" +
        "  Windows: winget install --id GitHub.cli\n" +
        "After installation, authenticate with: gh auth login",
    };
  }

  return { installed: true };
}

/**
 * Main function to create a pull request
 */
export async function createPullRequest(
  options: PrOptions = {},
): Promise<PrResult> {
  logger.debug("Creating pull request", { options });

  // Validate git environment
  const gitEnv = validateGitEnvironment();
  if (gitEnv.error) {
    return {
      success: false,
      message: "Validation failed",
      error: gitEnv.error,
    };
  }

  const { currentBranch, repoInfo } = gitEnv;

  logger.info(`Creating pull request for branch: ${currentBranch}`);
  logger.info(`Repository: ${repoInfo.owner}/${repoInfo.repo}`);

  // Check if GitHub CLI is installed
  const ghCheck = await ensureGitHubCliInstalled();
  if (!ghCheck.installed) {
    return {
      success: false,
      message: "GitHub CLI not installed",
      error: ghCheck.error,
    };
  }

  // Generate defaults if not provided
  const base = options.base || "main";
  let title = options.title;
  let body = options.body;

  if (!title) {
    title = getTitleFromBranch(currentBranch);
  }

  if (!body) {
    const commits = await getCommitMessages(base);
    if (commits) {
      body = `## Changes\n\n${commits}`;
    }
  }

  // Create the pull request
  try {
    const result = await createPrWithGh({
      ...options,
      title,
      body,
      base,
    });

    return {
      success: true,
      message: "Pull request created successfully",
      prUrl: result.prUrl,
    };
  } catch (error: any) {
    logger.error("Failed to create pull request", { error });
    return {
      success: false,
      message: "Failed to create pull request",
      error: error.message,
    };
  }
}
