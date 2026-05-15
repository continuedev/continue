import { FolderIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { ToggleWithIcon } from "./ToggleWithIcon";
import { getGroupActionVerb } from "./utils";

const GROUP_STATUS_SUMMARY_ORDER = [
  "active",
  "ready",
  "done",
  "errored",
  "canceled",
] as const;

type GroupStatusSummaryId = (typeof GROUP_STATUS_SUMMARY_ORDER)[number];

type GroupStatusSummary = {
  id: GroupStatusSummaryId;
  label: string;
  count: number;
  className: string;
};

type ReviewBatchSummary = {
  title: string;
  subtitle: string;
};

const READ_ONLY_TOOL_NAMES = new Set(
  [
    BuiltInToolNames.ReadFile,
    BuiltInToolNames.ReadFileRange,
    BuiltInToolNames.ReadCurrentlyOpenFile,
    BuiltInToolNames.LSTool,
    BuiltInToolNames.ViewRepoMap,
    BuiltInToolNames.ViewSubdirectory,
    BuiltInToolNames.GrepSearch,
    BuiltInToolNames.FileGlobSearch,
    BuiltInToolNames.CodebaseTool,
    BuiltInToolNames.SearchWeb,
    BuiltInToolNames.FetchUrlContent,
    BuiltInToolNames.Git,
    BuiltInToolNames.GitHub,
    BuiltInToolNames.Config,
    BuiltInToolNames.Status,
    "read_file",
    "list_dir",
    "file_search",
    "grep_search",
    "semantic_search",
    "fetch_webpage",
    "github_text_search",
    "github_repo",
    "get_task_output",
    "get_terminal_output",
  ].map((name) => name.toLowerCase()),
);

const READ_FILE_TOOL_NAMES = new Set(
  [
    BuiltInToolNames.ReadFile,
    BuiltInToolNames.ReadFileRange,
    BuiltInToolNames.ReadCurrentlyOpenFile,
    "read_file",
  ].map((name) => name.toLowerCase()),
);

const SEARCH_TOOL_NAMES = new Set(
  [
    BuiltInToolNames.GrepSearch,
    BuiltInToolNames.FileGlobSearch,
    BuiltInToolNames.CodebaseTool,
    BuiltInToolNames.SearchWeb,
    "file_search",
    "grep_search",
    "semantic_search",
    "github_text_search",
    "github_repo",
  ].map((name) => name.toLowerCase()),
);

function isActionActive(status: ToolCallState["status"]): boolean {
  return (
    status === "calling" || status === "generating" || status === "generated"
  );
}

function normalizeFunctionName(toolCallState: ToolCallState): string {
  return (toolCallState.toolCall.function?.name ?? "").toLowerCase();
}

function parsePathFromArgs(args: unknown): string | null {
  if (!args || typeof args !== "object") {
    return null;
  }

  const candidatePaths = [
    (args as { filePath?: unknown }).filePath,
    (args as { filepath?: unknown }).filepath,
    (args as { path?: unknown }).path,
    (args as { uri?: unknown }).uri,
  ];

  for (const candidate of candidatePaths) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function getReviewBatchSummary(
  toolCallStates: ToolCallState[],
): ReviewBatchSummary | null {
  if (toolCallStates.length < 5) {
    return null;
  }

  let reviewLikeCount = 0;
  let searchCount = 0;
  let inspectCount = 0;
  let readCount = 0;
  const uniqueReadTargets = new Set<string>();

  for (const toolCallState of toolCallStates) {
    const functionName = normalizeFunctionName(toolCallState);

    if (READ_FILE_TOOL_NAMES.has(functionName)) {
      reviewLikeCount += 1;
      readCount += 1;

      const readTarget =
        parsePathFromArgs(toolCallState.processedArgs) ??
        parsePathFromArgs(toolCallState.parsedArgs);

      if (readTarget) {
        uniqueReadTargets.add(readTarget.toLowerCase());
      }
      continue;
    }

    if (SEARCH_TOOL_NAMES.has(functionName)) {
      reviewLikeCount += 1;
      searchCount += 1;
      continue;
    }

    if (READ_ONLY_TOOL_NAMES.has(functionName)) {
      reviewLikeCount += 1;
      inspectCount += 1;
    }
  }

  const reviewThreshold = Math.max(4, Math.ceil(toolCallStates.length * 0.6));
  if (reviewLikeCount < reviewThreshold) {
    return null;
  }

  const hasActiveStep = toolCallStates.some((toolCallState) =>
    isActionActive(toolCallState.status),
  );
  const resolvedReadCount = uniqueReadTargets.size || readCount;
  const otherStepCount = toolCallStates.length - reviewLikeCount;

  const detailParts = [pluralize(toolCallStates.length, "action")];
  if (resolvedReadCount > 0) {
    detailParts.push(`read ${pluralize(resolvedReadCount, "file")}`);
  }
  if (searchCount > 0) {
    detailParts.push(`ran ${pluralize(searchCount, "search")}`);
  }
  if (inspectCount > 0) {
    detailParts.push(
      inspectCount === 1
        ? "inspected repository state"
        : `inspected repository state ${inspectCount} times`,
    );
  }
  if (otherStepCount > 0) {
    detailParts.push(`${pluralize(otherStepCount, "other step")}`);
  }

  return {
    title: `${hasActiveStep ? "Reviewing" : "Reviewed"} workspace context`,
    subtitle: detailParts.join(" · "),
  };
}

function getGroupStatusSummary(
  toolCallStates: ToolCallState[],
): GroupStatusSummary[] {
  const counts: Record<GroupStatusSummaryId, number> = {
    active: 0,
    ready: 0,
    done: 0,
    errored: 0,
    canceled: 0,
  };

  for (const toolCallState of toolCallStates) {
    switch (toolCallState.status) {
      case "calling":
      case "generating":
        counts.active += 1;
        break;
      case "generated":
        counts.ready += 1;
        break;
      case "done":
        counts.done += 1;
        break;
      case "errored":
        counts.errored += 1;
        break;
      case "canceled":
        counts.canceled += 1;
        break;
    }
  }

  const summaryConfig: Record<
    GroupStatusSummaryId,
    Omit<GroupStatusSummary, "count">
  > = {
    active: {
      id: "active",
      label: "active",
      className:
        "border-[color:var(--vscode-progressBar-background)] text-[color:var(--vscode-progressBar-background)]",
    },
    ready: {
      id: "ready",
      label: "ready",
      className:
        "border-[color:var(--vscode-textLink-foreground)] text-[color:var(--vscode-textLink-foreground)]",
    },
    done: {
      id: "done",
      label: "done",
      className:
        "border-[color:var(--vscode-testing-iconPassed)] text-[color:var(--vscode-testing-iconPassed)]",
    },
    errored: {
      id: "errored",
      label: "errored",
      className:
        "border-[color:var(--vscode-testing-iconFailed)] text-[color:var(--vscode-testing-iconFailed)]",
    },
    canceled: {
      id: "canceled",
      label: "canceled",
      className:
        "border-[color:var(--vscode-descriptionForeground)] text-[color:var(--vscode-descriptionForeground)]",
    },
  };

  return GROUP_STATUS_SUMMARY_ORDER.filter((id) => counts[id] > 0).map(
    (id) => ({
      ...summaryConfig[id],
      count: counts[id],
    }),
  );
}

interface GroupedToolCallHeaderProps {
  toolCallStates: ToolCallState[];
  activeCalls: ToolCallState[];
  open: boolean;
  onToggle: () => void;
}

export function GroupedToolCallHeader({
  toolCallStates,
  activeCalls,
  open,
  onToggle,
}: GroupedToolCallHeaderProps) {
  const statusSummary = getGroupStatusSummary(toolCallStates);
  const reviewSummary = getReviewBatchSummary(toolCallStates);
  const bodyId = "grouped-tool-call-body";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="mb-1">
      <div
        className="text-description flex cursor-pointer items-center gap-1.5 transition-colors duration-200 ease-in-out hover:brightness-125"
        data-testid="performing-actions"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label="Toggle grouped tool activity"
      >
        <ToggleWithIcon
          isToggleable
          icon={FolderIcon}
          open={open}
          onClick={onToggle}
          testId="grouped-tool-call-toggle"
        />
        {reviewSummary ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="bg-vsc-input-background rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                data-testid="grouped-tool-call-review-label"
              >
                Review
              </span>
              <span
                className="truncate text-xs font-medium"
                data-testid="grouped-tool-call-review-title"
              >
                {reviewSummary.title}
              </span>
            </div>
            <div
              className="text-description-muted truncate pt-0.5 text-[11px]"
              data-testid="grouped-tool-call-review-subtitle"
            >
              {reviewSummary.subtitle}
            </div>
          </div>
        ) : (
          <>
            {getGroupActionVerb(toolCallStates)} {activeCalls.length}{" "}
            {activeCalls.length === 1 ? "action" : "actions"}
          </>
        )}
      </div>
      {statusSummary.length > 0 && !reviewSummary && (
        <div
          className="mt-1 flex flex-wrap items-center gap-1.5 pl-4"
          data-testid="grouped-tool-call-status-summary"
        >
          {statusSummary.map((status) => (
            <span
              key={status.id}
              className={`bg-vsc-input-background inline-flex items-center rounded-full border border-solid px-2 py-0.5 text-[10px] font-medium ${status.className}`}
              data-testid={`grouped-tool-call-status-${status.id}`}
            >
              {status.count} {status.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
