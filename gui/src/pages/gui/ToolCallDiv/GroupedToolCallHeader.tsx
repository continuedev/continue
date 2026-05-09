import { FolderIcon } from "@heroicons/react/24/outline";
import { ToolCallState } from "core";
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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="mb-2">
      <div
        className="text-description flex cursor-pointer items-center gap-1.5 transition-colors duration-200 ease-in-out hover:brightness-125"
        data-testid="performing-actions"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={open}
      >
        <ToggleWithIcon
          isToggleable
          icon={FolderIcon}
          open={open}
          onClick={onToggle}
          testId="grouped-tool-call-toggle"
        />
        {getGroupActionVerb(toolCallStates)} {activeCalls.length}{" "}
        {activeCalls.length === 1 ? "action" : "actions"}
      </div>
      {statusSummary.length > 0 && (
        <div
          className="mt-2 flex flex-wrap items-center gap-1.5 pl-6"
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
