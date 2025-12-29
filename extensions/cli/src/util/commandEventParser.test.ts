import {
  parsePrCreatedOutput,
  parseCommentOutput,
  parseGitPushOutput,
  parseIssueCloseOutput,
  parseReviewOutput,
  parseCommentReplyOutput,
  parseResolveThreadOutput,
} from "./commandEventParser.js";

describe("parsePrCreatedOutput", () => {
  it("should parse gh pr create output with GitHub URL", () => {
    const output = `
Creating pull request for feature-branch into main in owner/repo

https://github.com/owner/repo/pull/123
`;
    const result = parsePrCreatedOutput(output);
    expect(result).toEqual({
      eventName: "pr_created",
      title: "Created PR #123 in owner/repo",
      externalUrl: "https://github.com/owner/repo/pull/123",
      metadata: { owner: "owner", repo: "repo", prNumber: 123 },
    });
  });

  it("should handle URL with different owner/repo names", () => {
    const output = "https://github.com/continuedev/continue/pull/456";
    const result = parsePrCreatedOutput(output);
    expect(result).toEqual({
      eventName: "pr_created",
      title: "Created PR #456 in continuedev/continue",
      externalUrl: "https://github.com/continuedev/continue/pull/456",
      metadata: { owner: "continuedev", repo: "continue", prNumber: 456 },
    });
  });

  it("should return null when no URL is found", () => {
    const output = "Pull request created successfully";
    const result = parsePrCreatedOutput(output);
    expect(result).toBeNull();
  });

  it("should handle output with multiple lines and noise", () => {
    const output = `
? Title My PR Title
? Body

Creating pull request for my-branch into main in myorg/myrepo

https://github.com/myorg/myrepo/pull/789
`;
    const result = parsePrCreatedOutput(output);
    expect(result?.metadata?.prNumber).toBe(789);
    expect(result?.metadata?.owner).toBe("myorg");
  });
});

describe("parseCommentOutput", () => {
  it("should parse gh pr comment command", () => {
    const command = "gh pr comment 123 --body 'LGTM!'";
    const output = "";
    const result = parseCommentOutput(command, output);
    expect(result).toEqual({
      eventName: "comment_posted",
      title: "Posted comment on PR #123",
      externalUrl: undefined,
      metadata: { prNumber: 123 },
    });
  });

  it("should parse gh issue comment command", () => {
    const command = "gh issue comment 456 --body 'Fixed in PR #789'";
    const output = "";
    const result = parseCommentOutput(command, output);
    expect(result).toEqual({
      eventName: "comment_posted",
      title: "Posted comment on issue #456",
      externalUrl: undefined,
      metadata: { issueNumber: 456 },
    });
  });

  it("should extract external URL from output when present", () => {
    const command = "gh pr comment 123 --body 'Done'";
    const output =
      "https://github.com/owner/repo/pull/123#issuecomment-987654321";
    const result = parseCommentOutput(command, output);
    expect(result?.externalUrl).toBe(
      "https://github.com/owner/repo/pull/123#issuecomment-987654321",
    );
  });

  it("should return null for non-comment commands", () => {
    const command = "gh pr view 123";
    const output = "";
    const result = parseCommentOutput(command, output);
    expect(result).toBeNull();
  });

  it("should handle case insensitive matching", () => {
    const command = "GH PR COMMENT 999 --body 'test'";
    const output = "";
    const result = parseCommentOutput(command, output);
    expect(result?.metadata?.prNumber).toBe(999);
  });
});

describe("parseGitPushOutput", () => {
  it("should parse git push output with branch name", () => {
    const output = `
To github.com:owner/repo.git
   abc123..def456  main -> main
`;
    const result = parseGitPushOutput(output);
    expect(result).toEqual({
      eventName: "commit_pushed",
      title: "Pushed commits to main",
      metadata: {
        branch: "main",
        repository: "owner/repo",
      },
    });
  });

  it("should parse new branch push", () => {
    const output = `
To github.com:owner/repo.git
 * [new branch]      feature-branch -> feature-branch
`;
    const result = parseGitPushOutput(output);
    expect(result?.title).toBe("Pushed commits to feature-branch");
    expect(result?.metadata?.branch).toBe("feature-branch");
  });

  it("should return generic title when branch cannot be extracted", () => {
    const output = "Everything up-to-date";
    const result = parseGitPushOutput(output);
    expect(result).toEqual({
      eventName: "commit_pushed",
      title: "Pushed commits",
      metadata: {
        branch: undefined,
        repository: undefined,
      },
    });
  });

  it("should handle HTTPS remote URL", () => {
    const output = `
To https://github.com/owner/repo.git
   111111..222222  develop -> develop
`;
    const result = parseGitPushOutput(output);
    expect(result?.metadata?.branch).toBe("develop");
  });
});

describe("parseIssueCloseOutput", () => {
  it("should parse gh issue close command", () => {
    const command = "gh issue close 42";
    const result = parseIssueCloseOutput(command);
    expect(result).toEqual({
      eventName: "issue_closed",
      title: "Closed issue #42",
      metadata: { issueNumber: 42 },
    });
  });

  it("should handle command with additional flags", () => {
    const command = "gh issue close 123 --comment 'Closing as duplicate'";
    const result = parseIssueCloseOutput(command);
    expect(result?.metadata?.issueNumber).toBe(123);
  });

  it("should return null for non-close commands", () => {
    const command = "gh issue view 42";
    const result = parseIssueCloseOutput(command);
    expect(result).toBeNull();
  });

  it("should handle case insensitive matching", () => {
    const command = "GH ISSUE CLOSE 789";
    const result = parseIssueCloseOutput(command);
    expect(result?.metadata?.issueNumber).toBe(789);
  });
});

describe("parseReviewOutput", () => {
  it("should parse gh pr review with --approve", () => {
    const command = "gh pr review 123 --approve";
    const result = parseReviewOutput(command);
    expect(result).toEqual({
      eventName: "review_submitted",
      title: "Submitted approval on PR #123",
      metadata: { prNumber: 123, reviewType: "approval" },
    });
  });

  it("should parse gh pr review with --comment", () => {
    const command = "gh pr review 456 --comment --body 'Needs work'";
    const result = parseReviewOutput(command);
    expect(result).toEqual({
      eventName: "review_submitted",
      title: "Submitted comment on PR #456",
      metadata: { prNumber: 456, reviewType: "comment" },
    });
  });

  it("should parse gh pr review with --request-changes", () => {
    const command = "gh pr review 789 --request-changes --body 'Please fix'";
    const result = parseReviewOutput(command);
    expect(result).toEqual({
      eventName: "review_submitted",
      title: "Submitted changes requested on PR #789",
      metadata: { prNumber: 789, reviewType: "changes requested" },
    });
  });

  it("should default to generic review type when no flag specified", () => {
    const command = "gh pr review 100";
    const result = parseReviewOutput(command);
    expect(result?.metadata?.reviewType).toBe("review");
  });

  it("should return null for non-review commands", () => {
    const command = "gh pr view 123";
    const result = parseReviewOutput(command);
    expect(result).toBeNull();
  });
});

describe("parseCommentReplyOutput", () => {
  it("should parse gh api comment reply command", () => {
    const command =
      'gh api -X POST repos/owner/repo/pulls/123/comments/456/replies -f body="Thanks for the review"';
    const result = parseCommentReplyOutput(command);
    expect(result).toEqual({
      eventName: "comment_reply_posted",
      title: "Replied to comment on PR #123",
      metadata: {
        owner: "owner",
        repo: "repo",
        prNumber: 123,
        commentId: 456,
      },
    });
  });

  it("should handle different owner/repo formats", () => {
    const command =
      "gh api -X POST repos/continuedev/continue/pulls/789/comments/999/replies -f body='Done'";
    const result = parseCommentReplyOutput(command);
    expect(result?.metadata).toEqual({
      owner: "continuedev",
      repo: "continue",
      prNumber: 789,
      commentId: 999,
    });
  });

  it("should handle command with extra whitespace", () => {
    const command =
      "gh api  -X POST  repos/org/project/pulls/1/comments/2/replies  -f body='test'";
    const result = parseCommentReplyOutput(command);
    expect(result?.metadata?.prNumber).toBe(1);
    expect(result?.metadata?.commentId).toBe(2);
  });

  it("should return null for non-reply API calls", () => {
    const command = "gh api repos/owner/repo/pulls/123";
    const result = parseCommentReplyOutput(command);
    expect(result).toBeNull();
  });

  it("should return null for regular gh commands", () => {
    const command = "gh pr comment 123 --body 'test'";
    const result = parseCommentReplyOutput(command);
    expect(result).toBeNull();
  });
});

describe("parseResolveThreadOutput", () => {
  it("should return a generic resolved event", () => {
    const result = parseResolveThreadOutput();
    expect(result).toEqual({
      eventName: "review_thread_resolved",
      title: "Resolved review thread",
      metadata: {},
    });
  });

  it("should always return the same structure", () => {
    const result1 = parseResolveThreadOutput();
    const result2 = parseResolveThreadOutput();
    expect(result1).toEqual(result2);
  });
});
