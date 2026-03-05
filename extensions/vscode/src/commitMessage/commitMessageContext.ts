export type CommitMessageContextMode = "staged" | "unstaged" | "selected";

export interface CommitMessageContextChange {
  status: string;
  filePath: string;
  staged?: boolean;
}

export interface CommitMessageContextInput {
  mode?: CommitMessageContextMode;
  diffs?: string[];
  changes?: CommitMessageContextChange[];
  branch?: string;
  recentCommits?: string;
  selectedFilesCount?: number;
}

const MODE_LABELS: Record<CommitMessageContextMode, string> = {
  staged: "Staged",
  unstaged: "Unstaged",
  selected: "Selected",
};

function getModeLabel(mode?: CommitMessageContextMode): string {
  if (!mode) {
    return MODE_LABELS.selected;
  }

  return MODE_LABELS[mode] ?? MODE_LABELS.selected;
}

function createFencedBlock(body: string, language?: string): string {
  const payload = body ? `${body}\n` : "";
  const fence = language ? "```" + language : "```";
  return `${fence}\n${payload}\`\`\``;
}

function buildDiffBlock(diffs?: string[]): string {
  const cleanedDiffs = (diffs ?? [])
    .map((diff) => diff?.trim())
    .filter((trimmed): trimmed is string => Boolean(trimmed));

  const diffBody =
    cleanedDiffs.length > 0 ? cleanedDiffs.join("\n") : "(No diff available)";

  return createFencedBlock(diffBody, "diff");
}

function getReadableStatus(status: string): string {
  switch (status.trim().toUpperCase()) {
    case "M":
      return "Modified";
    case "A":
      return "Added";
    case "D":
      return "Deleted";
    case "R":
      return "Renamed";
    case "C":
      return "Copied";
    case "U":
      return "Updated";
    case "?":
      return "Untracked";
    default:
      return "Unknown";
  }
}

function getScopeLabel(
  change: CommitMessageContextChange,
  modeLabel: CommitMessageContextMode,
): string {
  if (change.staged === true) {
    return "staged";
  }

  if (change.staged === false) {
    return "unstaged";
  }

  if (modeLabel === "staged") {
    return "staged";
  }

  if (modeLabel === "unstaged") {
    return "unstaged";
  }

  return "selected";
}

function buildChangeSummary(
  mode: CommitMessageContextMode,
  changes?: CommitMessageContextChange[],
): string {
  const safeChanges = changes ?? [];
  if (safeChanges.length === 0) {
    return createFencedBlock("(No changes matched selection)");
  }

  const summaryLines = safeChanges
    .map((change) => {
      const filePath = change.filePath?.trim();
      if (!filePath) {
        return "";
      }

      const readableStatus = getReadableStatus(change.status ?? "");
      const scope = getScopeLabel(change, mode);
      return `${readableStatus} (${scope}): ${filePath}`;
    })
    .filter(Boolean);

  return createFencedBlock(summaryLines.join("\n"));
}

function buildRepositoryContext(
  branch?: string,
  recentCommits?: string,
): string {
  const parts: string[] = [];

  const branchValue = branch?.trim();
  if (branchValue) {
    parts.push(`**Current branch:** \`${branchValue}\``);
  }

  const commitsBody = recentCommits?.trim();
  if (commitsBody) {
    parts.push(`**Recent commits:**\n${createFencedBlock(commitsBody)}`);
  }

  return parts.join("\n\n");
}

export function buildCommitMessageContext(
  input: CommitMessageContextInput,
): string {
  const modeValue = input.mode ?? "selected";
  const modeLabel = getModeLabel(modeValue);
  const fileInfo =
    input.selectedFilesCount && input.selectedFilesCount > 0
      ? ` (${input.selectedFilesCount} selected files)`
      : "";
  const diffSection = buildDiffBlock(input.diffs);
  const summarySection = buildChangeSummary(modeValue, input.changes);
  const repositorySection = buildRepositoryContext(
    input.branch,
    input.recentCommits,
  );

  return [
    "## Git Context for Commit Message Generation",
    "",
    `### Full Diff of ${modeLabel} Changes${fileInfo}`,
    "",
    diffSection,
    "",
    "### Change Summary",
    "",
    summarySection,
    "",
    "### Repository Context",
    "",
    repositorySection,
  ].join("\n");
}
