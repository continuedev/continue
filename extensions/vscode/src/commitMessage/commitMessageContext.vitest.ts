import { describe, expect, it } from "vitest";
import {
  buildCommitMessageContext,
  type CommitMessageContextInput,
} from "./commitMessageContext";

const sampleDiffs = [
  `diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@
-const foo = 1
+const foo = 2
`,
  `diff --git a/README.md b/README.md
index abcdef1..1234567 100644
--- a/README.md
+++ b/README.md
@@
-# Continue
+# Continue \u2764\ufe0f
`,
];

const sampleChanges: CommitMessageContextInput["changes"] = [
  { status: "M", filePath: "src/index.ts" },
  { status: "A", filePath: "README.md" },
];

const baseInput: CommitMessageContextInput = {
  mode: "staged",
  diffs: sampleDiffs,
  changes: sampleChanges,
  branch: "feature/report-builder",
  recentCommits: "abc123 Add builder\ndef456 Fix tests",
};

describe("buildCommitMessageContext", () => {
  it("renders each required section in order without forbidden headers", () => {
    const context = buildCommitMessageContext(baseInput);

    const mainHeader = "## Git Context for Commit Message Generation";
    const fullDiffHeader = "### Full Diff of Staged Changes";
    const summaryHeader = "### Change Summary";
    const repoHeader = "### Repository Context";

    const mainIndex = context.indexOf(mainHeader);
    const diffIndex = context.indexOf(fullDiffHeader);
    const summaryIndex = context.indexOf(summaryHeader);
    const repoIndex = context.indexOf(repoHeader);

    expect(mainIndex).toBeGreaterThanOrEqual(0);
    expect(diffIndex).toBeGreaterThan(mainIndex);
    expect(summaryIndex).toBeGreaterThan(diffIndex);
    expect(repoIndex).toBeGreaterThan(summaryIndex);

    expect(context).not.toContain("### Mode");
    expect(context).not.toContain("### Notes");

    const diffSection = context.slice(diffIndex, summaryIndex);
    expect(diffSection).toContain("```diff");
    expect(diffSection.indexOf(sampleDiffs[0].trim())).toBeLessThan(
      diffSection.indexOf(sampleDiffs[1].trim()),
    );

    const summarySection = context.slice(summaryIndex, repoIndex);
    expect(summarySection).toContain("```");
    expect(summarySection).toContain("Modified (staged): src/index.ts");
    expect(
      summarySection.indexOf("Modified (staged): src/index.ts"),
    ).toBeLessThan(summarySection.indexOf("Added (staged): README.md"));

    const repoSection = context.slice(repoIndex);
    expect(repoSection).toContain(
      "**Current branch:** `feature/report-builder`",
    );
    expect(repoSection).toContain("**Recent commits:**");
    expect(repoSection).toContain("```\nabc123 Add builder");
    expect(repoSection).toContain("abc123 Add builder");
  });

  it("appends selected files count to the full diff header", () => {
    const context = buildCommitMessageContext({
      ...baseInput,
      mode: "unstaged",
      selectedFilesCount: 3,
    });

    expect(context).toContain(
      "### Full Diff of Unstaged Changes (3 selected files)",
    );
  });

  it("falls back to the Selected label when mode is missing", () => {
    const context = buildCommitMessageContext({
      ...baseInput,
      mode: undefined,
      diffs: [""],
      changes: undefined,
      recentCommits: undefined,
    });

    expect(context).toContain("### Full Diff of Selected Changes");
    expect(context).toContain("### Change Summary");
    expect(context).toContain("### Repository Context");
    expect(context).toContain("(No diff available)");
    expect(context).toContain("(No changes matched selection)");
  });

  it("does not print placeholder branch when branch is empty", () => {
    const context = buildCommitMessageContext({
      ...baseInput,
      branch: "   ",
      recentCommits: undefined,
    });

    expect(context).toContain("### Repository Context");
    expect(context).not.toContain("**Current branch:**");
  });
});
