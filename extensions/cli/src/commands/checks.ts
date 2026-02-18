import chalk from "chalk";

import { get, post } from "../util/apiClient.js";
import { gracefulExit } from "../util/exit.js";
import { getGitBranch, getGitRemoteUrl } from "../util/git.js";
import { logger } from "../util/logger.js";

interface CheckStatus {
  name: string;
  state: "pending" | "success" | "failure";
  description: string;
  sessionId: string;
  commitMessage: string | null;
  suggestionStatus: string | null;
  agentStatus: string;
}

interface ChecksStatusResponse {
  checks: CheckStatus[];
  pullRequestUrl: string;
}

/**
 * Parse owner/repo from a git remote URL.
 * Supports HTTPS and SSH formats.
 */
function parseOwnerRepo(
  remoteUrl: string,
): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = remoteUrl.match(
    /github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/,
  );
  if (httpsMatch && httpsMatch[1] && httpsMatch[2]) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  // SSH: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (sshMatch && sshMatch[1] && sshMatch[2]) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }
  return null;
}

/**
 * Auto-detect the PR URL from the current git branch using the GitHub API.
 */
async function detectPrUrl(): Promise<string | null> {
  const branch = getGitBranch();
  if (!branch) {
    return null;
  }

  const remoteUrl = getGitRemoteUrl();
  if (!remoteUrl) {
    return null;
  }

  const parsed = parseOwnerRepo(remoteUrl);
  if (!parsed) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls?head=${parsed.owner}:${branch}&state=open`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      },
    );

    if (!response.ok) {
      logger.debug(`GitHub API returned ${response.status}`);
      return null;
    }

    const prs = (await response.json()) as Array<{ html_url: string }>;
    if (prs.length > 0 && prs[0]) {
      return prs[0].html_url;
    }
  } catch (err) {
    logger.debug(`Failed to detect PR URL: ${err}`);
  }

  return null;
}

/**
 * Resolve the PR URL from the argument or auto-detect from git.
 */
async function resolvePrUrl(prUrlArg: string | undefined): Promise<string> {
  if (prUrlArg) {
    return prUrlArg;
  }

  console.log(chalk.dim("Auto-detecting PR from current branch..."));
  const detected = await detectPrUrl();
  if (!detected) {
    console.error(
      chalk.red(
        "Could not detect a PR for the current branch. Please provide a PR URL.",
      ),
    );
    await gracefulExit(1);
    throw new Error("unreachable");
  }

  console.log(chalk.dim(`Found PR: ${detected}`));
  return detected;
}

const STATE_ICONS: Record<string, string> = {
  success: chalk.green("\u2714"),
  failure: chalk.red("\u2716"),
  pending: chalk.yellow("\u25CB"),
};

/**
 * Fetch and print the diff for a check, indented under the check output.
 */
async function printCheckDiff(check: CheckStatus): Promise<void> {
  try {
    const diffResponse = await get<{ diff: string }>(
      `agents/${check.sessionId}/diff`,
    );
    if (!diffResponse.data.diff) {
      return;
    }
    console.log(`\n${chalk.bold(`   Diff:`)}`);
    for (const line of diffResponse.data.diff.split("\n")) {
      console.log(`   ${line}`);
    }
  } catch (err) {
    logger.debug(`Failed to fetch diff for ${check.sessionId}: ${err}`);
  }
}

/**
 * List check statuses for a PR, including diffs for checks with commits.
 */
async function listChecks(prUrl: string): Promise<void> {
  const response = await get<ChecksStatusResponse>(
    `api/checks/status?pullRequestUrl=${encodeURIComponent(prUrl)}`,
  );
  const { checks } = response.data;

  if (checks.length === 0) {
    console.log(chalk.dim("No checks found for this PR."));
    return;
  }

  console.log(chalk.bold(`\nChecks for ${chalk.cyan(prUrl)}\n`));

  for (const check of checks) {
    const icon = STATE_ICONS[check.state] || "?";
    console.log(`${icon}  ${chalk.bold(check.name)}`);
    console.log(`   ${chalk.dim(check.description)}`);

    if (check.commitMessage) {
      console.log(`   Commit: ${check.commitMessage}`);
    }

    if (check.suggestionStatus) {
      const statusColor =
        check.suggestionStatus === "pending"
          ? chalk.yellow
          : check.suggestionStatus === "accepted"
            ? chalk.green
            : chalk.red;
      console.log(`   Suggestion: ${statusColor(check.suggestionStatus)}`);
    }

    if (check.commitMessage) {
      await printCheckDiff(check);
    }

    console.log();
  }

  // Summary line
  const pending = checks.filter((c) => c.state === "pending").length;
  const failures = checks.filter((c) => c.state === "failure").length;
  const successes = checks.filter((c) => c.state === "success").length;

  const parts: string[] = [];
  if (successes > 0) parts.push(chalk.green(`${successes} passed`));
  if (failures > 0) parts.push(chalk.red(`${failures} failing`));
  if (pending > 0) parts.push(chalk.yellow(`${pending} pending`));
  console.log(parts.join(", "));

  // Exit code: 0=all pass, 1=any failure, 2=still pending
  if (failures > 0) {
    await gracefulExit(1);
  } else if (pending > 0) {
    await gracefulExit(2);
  }
}

/**
 * Accept all pending suggestions for a PR.
 */
async function acceptChecks(prUrl: string): Promise<void> {
  const response = await get<ChecksStatusResponse>(
    `api/checks/status?pullRequestUrl=${encodeURIComponent(prUrl)}`,
  );
  const { checks } = response.data;

  const pending = checks.filter(
    (c) => c.suggestionStatus === "pending" && c.commitMessage,
  );

  if (pending.length === 0) {
    console.log(chalk.dim("No pending suggestions to accept."));
    return;
  }

  console.log(
    chalk.bold(`Accepting ${pending.length} pending suggestion(s)...\n`),
  );

  for (const check of pending) {
    try {
      await post(`agents/${check.sessionId}/accept`);
      console.log(chalk.green(`\u2714  Accepted: ${check.name}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        chalk.red(`\u2716  Failed to accept ${check.name}: ${msg}`),
      );
    }
  }
}

/**
 * Reject all pending suggestions for a PR.
 */
async function rejectChecks(prUrl: string): Promise<void> {
  const response = await get<ChecksStatusResponse>(
    `api/checks/status?pullRequestUrl=${encodeURIComponent(prUrl)}`,
  );
  const { checks } = response.data;

  const pending = checks.filter(
    (c) => c.suggestionStatus === "pending" && c.commitMessage,
  );

  if (pending.length === 0) {
    console.log(chalk.dim("No pending suggestions to reject."));
    return;
  }

  console.log(
    chalk.bold(`Rejecting ${pending.length} pending suggestion(s)...\n`),
  );

  for (const check of pending) {
    try {
      await post(`agents/${check.sessionId}/reject`);
      console.log(chalk.red(`\u2716  Rejected: ${check.name}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        chalk.red(`\u2716  Failed to reject ${check.name}: ${msg}`),
      );
    }
  }
}

/**
 * Main entry point for `cn checks` command.
 *
 * Usage:
 *   cn checks [pr-url]              - List checks with diffs
 *   cn checks accept [pr-url]       - Accept pending suggestions
 *   cn checks reject [pr-url]       - Reject pending suggestions
 */
export async function checks(
  actionOrUrl: string | undefined,
  prUrlArg: string | undefined,
): Promise<void> {
  try {
    // Determine if first arg is an action or a PR URL
    let action: "list" | "accept" | "reject" = "list";
    let rawPrUrl: string | undefined = prUrlArg;

    if (actionOrUrl === "accept" || actionOrUrl === "reject") {
      action = actionOrUrl;
      // prUrlArg already has the right value from Commander
    } else if (actionOrUrl) {
      // First arg is a PR URL, not an action
      rawPrUrl = actionOrUrl;
    }

    const prUrl = await resolvePrUrl(rawPrUrl);

    switch (action) {
      case "accept":
        await acceptChecks(prUrl);
        break;
      case "reject":
        await rejectChecks(prUrl);
        break;
      default:
        await listChecks(prUrl);
        break;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AuthenticationRequiredError") {
      console.error(chalk.red(err.message));
      await gracefulExit(1);
    }
    throw err;
  }
}
