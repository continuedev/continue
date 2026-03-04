import { describe, expect, it, vi } from "vitest";
import { CommitMessageGenerator } from "./CommitMessageGenerator";

function chunkStream(chunks: string[]) {
  return (async function* () {
    for (const content of chunks) {
      yield { content };
    }
  })();
}

function makeLlm(
  customTemplate?: string,
  chunks: string[] = ["feat: default"],
) {
  return {
    promptTemplates: customTemplate ? { commitMessage: customTemplate } : {},
    streamChat: vi.fn().mockImplementation(() => chunkStream(chunks)),
  };
}

const lockfileDiff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index abcdef1..1234567 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@
-lockfileVersion: 9
+lockfileVersion: 10
`;

const sourceDiff = `diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@
-const value = 1
+const value = 2
`;

const redactedPlaceholder =
  "Security-sensitive file redacted: /repo/.aws/credentials";

describe("extractCommitMessage", () => {
  it("strips markdown code fences", () => {
    const generator = new CommitMessageGenerator();
    const response = "```markdown\nfeat: add commit message generation\n```";

    expect(generator.extractCommitMessage(response)).toBe(
      "feat: add commit message generation",
    );
  });

  it("strips wrapping quotes", () => {
    const generator = new CommitMessageGenerator();
    expect(generator.extractCommitMessage('"fix: quote cleanup"')).toBe(
      "fix: quote cleanup",
    );
    expect(generator.extractCommitMessage("'docs: single quote cleanup'")).toBe(
      "docs: single quote cleanup",
    );
  });

  it("trims whitespace", () => {
    const generator = new CommitMessageGenerator();
    expect(generator.extractCommitMessage("  \n docs: trim me \n  ")).toBe(
      "docs: trim me",
    );
  });

  it("passes through plain text", () => {
    const generator = new CommitMessageGenerator();
    expect(generator.extractCommitMessage("chore: plain text")).toBe(
      "chore: plain text",
    );
  });
});

describe("buildPrompt", () => {
  it("default prompt contains Conventional Commit types list", () => {
    const generator = new CommitMessageGenerator();
    const prompt = generator.buildPrompt("git context", makeLlm());

    for (const type of [
      "feat",
      "fix",
      "docs",
      "style",
      "chore",
      "refactor",
      "perf",
      "test",
      "ci",
      "build",
      "revert",
    ]) {
      expect(prompt).toContain(type);
    }
  });

  it("uses custom template when llm.promptTemplates.commitMessage exists", () => {
    const generator = new CommitMessageGenerator();
    const customTemplate = "Use this custom commit template";
    const prompt = generator.buildPrompt(
      "git context",
      makeLlm(customTemplate),
    );

    expect(prompt).toContain(customTemplate);
    expect(prompt).toContain("git context");
  });
});

describe("buildGitContext", () => {
  it("uses report-style sections and includes repository metadata", () => {
    const generator = new CommitMessageGenerator();
    const context = generator.buildGitContext({
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/tdd-red",
      recentCommits: "abc1234 feat: previous",
    });

    expect(context).toContain("## Git Context for Commit Message Generation");
    expect(context).toContain("### Full Diff of Staged Changes");
    expect(context).toContain("### Change Summary");
    expect(context).toContain("### Repository Context");
    expect(context).toContain("feature/tdd-red");
    expect(context).toContain("abc1234 feat: previous");
    expect(context).toContain(sourceDiff);
    expect(context).not.toContain("### Diff 1");
  });

  it("filters lockfile diffs using shouldExclude", () => {
    const generator = new CommitMessageGenerator();
    const context = generator.buildGitContext({
      diffs: [lockfileDiff, sourceDiff],
      branch: "feature/filter-lockfiles",
    });

    expect(context).toContain(sourceDiff);
    expect(context).not.toContain(lockfileDiff);
  });

  it("keeps non-patch security placeholders in git context", () => {
    const generator = new CommitMessageGenerator();
    const context = generator.buildGitContext({
      diffs: [redactedPlaceholder, sourceDiff],
      branch: "feature/keep-redacted-placeholder",
    });

    expect(context).toContain(redactedPlaceholder);
    expect(context).toContain(sourceDiff);
  });

  it("does not truncate large git context", () => {
    const generator = new CommitMessageGenerator();
    const hugeDiff = `diff --git a/src/huge.ts b/src/huge.ts\n${"+line\n".repeat(30_000)}`;
    const context = generator.buildGitContext({
      diffs: [hugeDiff],
      branch: "feature/no-truncate",
    });

    expect(context.length).toBeGreaterThan(100_000);
    expect(context).not.toContain("Truncated git context");
  });
});

describe("regenerate behavior", () => {
  it("first call without prior state does not include DIFFERENT", () => {
    const generator = new CommitMessageGenerator();
    const prompt = generator.buildPrompt("same-context", makeLlm());

    expect(prompt).not.toContain("DIFFERENT");
  });

  it("same gitContext with previous message includes DIFFERENT and previous text", async () => {
    const generator = new CommitMessageGenerator();
    const commitLlm = makeLlm(undefined, ["feat: previous message"]);
    const configHandler = {
      loadConfig: vi.fn().mockResolvedValue({
        config: { selectedModelByRole: { commitMessage: commitLlm } },
      }),
    };

    await generator.generateCommitMessage(configHandler, {
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/regenerate",
      recentCommits: "abc1234 feat: previous",
    });

    const sameGitContext = generator.buildGitContext({
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/regenerate",
      recentCommits: "abc1234 feat: previous",
    });
    const prompt = generator.buildPrompt(sameGitContext, makeLlm());

    expect(prompt).toContain("DIFFERENT");
    expect(prompt).toContain("feat: previous message");
  });

  it("different gitContext does not include DIFFERENT", async () => {
    const generator = new CommitMessageGenerator();
    const commitLlm = makeLlm(undefined, ["fix: old message"]);
    const configHandler = {
      loadConfig: vi.fn().mockResolvedValue({
        config: { selectedModelByRole: { commitMessage: commitLlm } },
      }),
    };

    await generator.generateCommitMessage(configHandler, {
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/old-context",
    });

    const prompt = generator.buildPrompt("new-context", makeLlm());
    expect(prompt).not.toContain("DIFFERENT");
  });
});

describe("generateCommitMessage", () => {
  it("throws when opts are missing", async () => {
    const generator = new CommitMessageGenerator();
    const llm = makeLlm();
    const configHandler = {
      loadConfig: vi.fn().mockResolvedValue({
        config: { selectedModelByRole: { commitMessage: llm } },
      }),
    };

    await expect(
      generator.generateCommitMessage(configHandler),
    ).rejects.toThrow("Diffs and branch are required");
  });

  it("uses commitMessage model, concatenates stream chunks, and stores regenerate state", async () => {
    const generator = new CommitMessageGenerator();
    const commitLlm = makeLlm(undefined, [
      "```markdown\n",
      "feat: add generator\n",
      "```",
    ]);
    const editLlm = makeLlm(undefined, ["fix: should not be used"]);
    const chatLlm = makeLlm(undefined, ["chore: should not be used"]);
    const configHandler = {
      loadConfig: vi.fn().mockResolvedValue({
        config: {
          selectedModelByRole: {
            commitMessage: commitLlm,
            edit: editLlm,
            chat: chatLlm,
          },
        },
      }),
    };

    const message = await generator.generateCommitMessage(configHandler, {
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/regenerate",
      recentCommits: "abc1234 feat: previous",
    });

    expect(message).toBe("feat: add generator");
    expect(commitLlm.streamChat).toHaveBeenCalledTimes(1);
    expect(editLlm.streamChat).not.toHaveBeenCalled();
    expect(chatLlm.streamChat).not.toHaveBeenCalled();

    const [messages] = commitLlm.streamChat.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("feature/regenerate");

    const sameGitContext = generator.buildGitContext({
      mode: "staged",
      diffs: [sourceDiff],
      changes: [{ status: "M", filePath: "src/index.ts" }],
      branch: "feature/regenerate",
      recentCommits: "abc1234 feat: previous",
    });
    const regeneratePrompt = generator.buildPrompt(sameGitContext, makeLlm());
    expect(regeneratePrompt).toContain("DIFFERENT");
    expect(regeneratePrompt).toContain("feat: add generator");
  });

  it("throws actionable error when commitMessage model is unavailable", async () => {
    const generator = new CommitMessageGenerator();
    const editLlm = makeLlm(undefined, ["fix: should not be used"]);
    const chatLlm = makeLlm(undefined, ["chore: should not be used"]);
    const configHandler = {
      loadConfig: vi.fn().mockResolvedValue({
        config: {
          selectedModelByRole: {
            edit: editLlm,
            chat: chatLlm,
          },
        },
      }),
    };

    await expect(
      generator.generateCommitMessage(configHandler, {
        diffs: [sourceDiff],
        branch: "feature/missing-commit-message-role",
      }),
    ).rejects.toThrow(
      "No commitMessage model selected. Configure config.selectedModelByRole.commitMessage.",
    );
    expect(editLlm.streamChat).not.toHaveBeenCalled();
    expect(chatLlm.streamChat).not.toHaveBeenCalled();
  });
});
