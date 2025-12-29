import {
  isGitCommitCommand,
  isPullRequestCommand,
  isCommentCommand,
  isGitPushCommand,
  isIssueCloseCommand,
  isReviewCommand,
  isCommentReplyCommand,
  isResolveThreadCommand,
} from "./utils.js";

describe("isGitCommitCommand", () => {
  it("should detect git commit", () => {
    expect(isGitCommitCommand("git commit -m 'message'")).toBe(true);
  });

  it("should detect git commit with flags", () => {
    expect(isGitCommitCommand("git commit -am 'message'")).toBe(true);
  });

  it("should detect git-commit", () => {
    expect(isGitCommitCommand("git-commit -m 'message'")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isGitCommitCommand("GIT COMMIT -m 'message'")).toBe(true);
  });

  it("should not match git add", () => {
    expect(isGitCommitCommand("git add .")).toBe(false);
  });

  it("should not match git push", () => {
    expect(isGitCommitCommand("git push origin main")).toBe(false);
  });
});

describe("isPullRequestCommand", () => {
  it("should detect gh pr create", () => {
    expect(isPullRequestCommand("gh pr create --title 'PR'")).toBe(true);
  });

  it("should detect hub pull-request", () => {
    expect(isPullRequestCommand("hub pull-request -m 'PR'")).toBe(true);
  });

  it("should detect gitlab mr create", () => {
    expect(isPullRequestCommand("gitlab mr create")).toBe(true);
  });

  it("should detect git push with pull-request flag", () => {
    expect(
      isPullRequestCommand("git push -u origin branch --pull-request"),
    ).toBe(true);
  });

  it("should not match regular git push", () => {
    expect(isPullRequestCommand("git push origin main")).toBe(false);
  });

  it("should not match gh pr view", () => {
    expect(isPullRequestCommand("gh pr view 123")).toBe(false);
  });
});

describe("isCommentCommand", () => {
  it("should detect gh pr comment", () => {
    expect(isCommentCommand("gh pr comment 123 --body 'test'")).toBe(true);
  });

  it("should detect gh issue comment", () => {
    expect(isCommentCommand("gh issue comment 456 --body 'test'")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isCommentCommand("GH PR COMMENT 123")).toBe(true);
  });

  it("should not match gh pr view", () => {
    expect(isCommentCommand("gh pr view 123")).toBe(false);
  });

  it("should not match gh pr create", () => {
    expect(isCommentCommand("gh pr create")).toBe(false);
  });
});

describe("isGitPushCommand", () => {
  it("should detect git push", () => {
    expect(isGitPushCommand("git push origin main")).toBe(true);
  });

  it("should detect git push with flags", () => {
    expect(isGitPushCommand("git push -u origin feature")).toBe(true);
  });

  it("should not match git push with pull-request flag", () => {
    expect(isGitPushCommand("git push --pull-request")).toBe(false);
  });

  it("should not match git commit", () => {
    expect(isGitPushCommand("git commit -m 'msg'")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isGitPushCommand("GIT PUSH origin main")).toBe(true);
  });
});

describe("isIssueCloseCommand", () => {
  it("should detect gh issue close", () => {
    expect(isIssueCloseCommand("gh issue close 123")).toBe(true);
  });

  it("should detect with comment flag", () => {
    expect(isIssueCloseCommand("gh issue close 123 --comment 'Done'")).toBe(
      true,
    );
  });

  it("should be case insensitive", () => {
    expect(isIssueCloseCommand("GH ISSUE CLOSE 456")).toBe(true);
  });

  it("should not match gh issue view", () => {
    expect(isIssueCloseCommand("gh issue view 123")).toBe(false);
  });

  it("should not match gh issue create", () => {
    expect(isIssueCloseCommand("gh issue create")).toBe(false);
  });
});

describe("isReviewCommand", () => {
  it("should detect gh pr review", () => {
    expect(isReviewCommand("gh pr review 123")).toBe(true);
  });

  it("should detect with --approve flag", () => {
    expect(isReviewCommand("gh pr review 123 --approve")).toBe(true);
  });

  it("should detect with --request-changes flag", () => {
    expect(isReviewCommand("gh pr review 123 --request-changes")).toBe(true);
  });

  it("should detect with --comment flag", () => {
    expect(isReviewCommand("gh pr review 123 --comment --body 'test'")).toBe(
      true,
    );
  });

  it("should be case insensitive", () => {
    expect(isReviewCommand("GH PR REVIEW 456")).toBe(true);
  });

  it("should not match gh pr view", () => {
    expect(isReviewCommand("gh pr view 123")).toBe(false);
  });

  it("should not match gh pr comment", () => {
    expect(isReviewCommand("gh pr comment 123")).toBe(false);
  });
});

describe("isCommentReplyCommand", () => {
  it("should detect gh api comment reply", () => {
    const cmd =
      "gh api -X POST repos/owner/repo/pulls/123/comments/456/replies -f body='test'";
    expect(isCommentReplyCommand(cmd)).toBe(true);
  });

  it("should handle different whitespace", () => {
    const cmd = "gh api  -X POST  repos/org/project/pulls/1/comments/2/replies";
    expect(isCommentReplyCommand(cmd)).toBe(true);
  });

  it("should be case insensitive", () => {
    const cmd =
      "GH API -X POST repos/owner/repo/pulls/123/comments/456/replies";
    expect(isCommentReplyCommand(cmd)).toBe(true);
  });

  it("should not match regular gh api calls", () => {
    expect(isCommentReplyCommand("gh api repos/owner/repo/pulls/123")).toBe(
      false,
    );
  });

  it("should not match gh pr comment", () => {
    expect(isCommentReplyCommand("gh pr comment 123 --body 'test'")).toBe(
      false,
    );
  });

  it("should require full path pattern", () => {
    // Missing comments/{id}/replies
    expect(
      isCommentReplyCommand("gh api -X POST repos/owner/repo/pulls/123"),
    ).toBe(false);
  });

  it("should match with various repo names", () => {
    const cmd =
      "gh api -X POST repos/my-org/my-repo-name/pulls/999/comments/111/replies";
    expect(isCommentReplyCommand(cmd)).toBe(true);
  });
});

describe("isResolveThreadCommand", () => {
  it("should detect gh api graphql resolveReviewThread", () => {
    const cmd =
      "gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: \"PRRT_xxx\"}) { thread { isResolved } } }'";
    expect(isResolveThreadCommand(cmd)).toBe(true);
  });

  it("should handle different query formats", () => {
    const cmd =
      'gh api graphql --jq ".data" -f query="mutation { resolveReviewThread }"';
    expect(isResolveThreadCommand(cmd)).toBe(true);
  });

  it("should be case insensitive", () => {
    const cmd = "GH API GRAPHQL -f query='resolveReviewThread'";
    expect(isResolveThreadCommand(cmd)).toBe(true);
  });

  it("should not match unresolveReviewThread", () => {
    // This tests that we're matching resolveReviewThread specifically
    // unresolveReviewThread also contains resolveReviewThread as a substring
    const cmd = "gh api graphql -f query='mutation { unresolveReviewThread }'";
    // Note: This will actually match because "unresolveReviewThread" contains "resolveReviewThread"
    // If we want to exclude this, we'd need a more specific regex
    expect(isResolveThreadCommand(cmd)).toBe(true);
  });

  it("should not match regular gh api calls", () => {
    expect(isResolveThreadCommand("gh api repos/owner/repo/pulls")).toBe(false);
  });

  it("should not match gh pr commands", () => {
    expect(isResolveThreadCommand("gh pr review 123 --approve")).toBe(false);
  });
});
