/**
 * Parse command output to extract event details for Activity Timeline
 */

export interface ParsedEventDetails {
  eventName: string;
  title: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parse output from `gh pr create` to extract PR details
 */
export function parsePrCreatedOutput(
  output: string,
): ParsedEventDetails | null {
  // gh pr create outputs URL like: https://github.com/owner/repo/pull/123
  const urlMatch = output.match(
    /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/,
  );
  if (urlMatch) {
    const [url, owner, repo, prNumber] = urlMatch;
    return {
      eventName: "pr_created",
      title: `Created PR #${prNumber} in ${owner}/${repo}`,
      externalUrl: url,
      metadata: { owner, repo, prNumber: parseInt(prNumber) },
    };
  }
  return null;
}

/**
 * Parse output from `gh pr comment` or `gh issue comment`
 */
export function parseCommentOutput(
  command: string,
  output: string,
): ParsedEventDetails | null {
  // Extract PR/issue number from command: gh pr comment 123 or gh issue comment 456
  const prMatch = command.match(/gh pr comment (\d+)/i);
  const issueMatch = command.match(/gh issue comment (\d+)/i);

  // Try to extract URL from output for externalUrl
  const urlMatch = output.match(
    /https:\/\/github\.com\/[^\/]+\/[^\/]+\/(pull|issues)\/\d+#issuecomment-\d+/,
  );

  if (prMatch) {
    return {
      eventName: "comment_posted",
      title: `Posted comment on PR #${prMatch[1]}`,
      externalUrl: urlMatch?.[0],
      metadata: { prNumber: parseInt(prMatch[1]) },
    };
  }
  if (issueMatch) {
    return {
      eventName: "comment_posted",
      title: `Posted comment on issue #${issueMatch[1]}`,
      externalUrl: urlMatch?.[0],
      metadata: { issueNumber: parseInt(issueMatch[1]) },
    };
  }
  return null;
}

/**
 * Parse output from `git push`
 */
export function parseGitPushOutput(output: string): ParsedEventDetails | null {
  // git push output contains branch info like:
  // To github.com:owner/repo.git
  //  * [new branch]      feature -> feature
  // or
  //    abc123..def456  main -> main
  const branchMatch = output.match(/->\s+([^\s\]]+)/);
  const repoMatch = output.match(/To (?:.*[:/])([^\/]+\/[^\.]+)/);

  return {
    eventName: "commit_pushed",
    title: branchMatch
      ? `Pushed commits to ${branchMatch[1]}`
      : "Pushed commits",
    metadata: {
      branch: branchMatch?.[1],
      repository: repoMatch?.[1],
    },
  };
}

/**
 * Parse output from `gh issue close`
 */
export function parseIssueCloseOutput(
  command: string,
): ParsedEventDetails | null {
  const match = command.match(/gh issue close (\d+)/i);
  if (match) {
    return {
      eventName: "issue_closed",
      title: `Closed issue #${match[1]}`,
      metadata: { issueNumber: parseInt(match[1]) },
    };
  }
  return null;
}

/**
 * Parse output from `gh pr review`
 */
export function parseReviewOutput(command: string): ParsedEventDetails | null {
  const prMatch = command.match(/gh pr review (\d+)/i);
  // Check for review type flags: --approve, --comment, --request-changes
  const approveMatch = command.match(/--approve/i);
  const commentMatch = command.match(/--comment/i);
  const requestChangesMatch = command.match(/--request-changes/i);

  if (prMatch) {
    let reviewType = "review";
    if (approveMatch) reviewType = "approval";
    else if (requestChangesMatch) reviewType = "changes requested";
    else if (commentMatch) reviewType = "comment";

    return {
      eventName: "review_submitted",
      title: `Submitted ${reviewType} on PR #${prMatch[1]}`,
      metadata: { prNumber: parseInt(prMatch[1]), reviewType },
    };
  }
  return null;
}

/**
 * Parse gh api comment reply command
 * Pattern: gh api -X POST repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies -f body="..."
 */
export function parseCommentReplyOutput(
  command: string,
): ParsedEventDetails | null {
  // Extract: repos/owner/repo/pulls/123/comments/456/replies
  const match = command.match(
    /repos\/([^\/]+)\/([^\/]+)\/pulls\/(\d+)\/comments\/(\d+)\/replies/i,
  );
  if (match) {
    const [, owner, repo, prNumber, commentId] = match;
    return {
      eventName: "comment_reply_posted",
      title: `Replied to comment on PR #${prNumber}`,
      metadata: {
        owner,
        repo,
        prNumber: parseInt(prNumber),
        commentId: parseInt(commentId),
      },
    };
  }
  return null;
}

/**
 * Parse gh api graphql resolveReviewThread command
 */
export function parseResolveThreadOutput(): ParsedEventDetails | null {
  // The threadId is in the graphql query, but we may not be able to extract PR number
  // Just emit a generic event
  return {
    eventName: "review_thread_resolved",
    title: "Resolved review thread",
    metadata: {},
  };
}
