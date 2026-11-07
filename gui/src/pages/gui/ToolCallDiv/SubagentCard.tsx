import {
  ChevronDownIcon,
  ChevronRightIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import type { SubagentRunState, ToolCallState } from "core";
import type { SubagentRunStatus } from "core/subagents/result";
import { useState } from "react";
import { Button } from "../../../components/ui";
import {
  answerSubagentApproval,
  stopSubagentRun,
} from "../../../util/subagents/registry";
import { getStatusIcon } from "./utils";

const STATUS_LABEL: Record<SubagentRunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Done",
  partial: "Stopped at turn limit",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

const STATUS_CLASS: Record<SubagentRunStatus, string> = {
  queued: "text-description",
  running: "text-description",
  completed: "text-success",
  partial: "text-warning",
  failed: "text-error",
  cancelled: "text-warning",
  interrupted: "text-warning",
};

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function Disclosure({
  label,
  open,
  onToggle,
  testId,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  testId: string;
}) {
  const Icon = open ? ChevronDownIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left text-xs text-description hover:brightness-125"
      onClick={onToggle}
      aria-expanded={open}
      data-testid={testId}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {label}
    </button>
  );
}

interface SubagentCardProps {
  toolCallState: ToolCallState;
}

/**
 * One subagent run in the parent's chat: who it is, what it was asked, what
 * it is doing (tools by name as they happen, never their output), its answer
 * once it has one, and Stop. A call it wants to make that needs approval is
 * asked here, labelled with the agent's name.
 */
export function SubagentCard({ toolCallState }: SubagentCardProps) {
  const args = toolCallState.parsedArgs ?? {};
  const run: SubagentRunState = toolCallState.subagent ?? {
    agent: typeof args.agent === "string" ? args.agent : "subagent",
    prompt: typeof args.prompt === "string" ? args.prompt : "",
    description:
      typeof args.description === "string" ? args.description : undefined,
    // Not started yet: generating, or waiting for the parent's approval.
    status: "queued",
    toolCalls: [],
    text: "",
  };
  const [promptOpen, setPromptOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(true);
  const id = toolCallState.toolCallId;

  const live = run.status === "running" || run.status === "queued";
  const started = !!toolCallState.subagent;
  const finished = started && !live;
  const statusIcon =
    run.status === "running" || run.status === "queued"
      ? getStatusIcon(started ? "calling" : toolCallState.status)
      : getStatusIcon(run.status === "completed" ? "done" : "errored");
  const label = started
    ? STATUS_LABEL[run.status]
    : toolCallState.status === "canceled"
      ? "Not started"
      : toolCallState.status === "errored"
        ? "Failed"
        : "Starting";
  const tokens = run.usage ? run.usage.inputTokens + run.usage.outputTokens : 0;

  return (
    <div
      className="mx-1 my-1 flex min-w-0 flex-col gap-1.5 rounded-md border border-solid border-border px-3 py-2 text-xs"
      data-testid={`subagent-card-${id}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex h-3.5 w-3.5 flex-shrink-0 items-center">
          {statusIcon}
        </span>
        <span className="font-semibold break-all">{run.agent}</span>
        {run.description && (
          <span className="min-w-0 break-words text-description">
            {run.description}
          </span>
        )}
        <span
          className={`${STATUS_CLASS[run.status]}`}
          data-testid={`subagent-status-${id}`}
        >
          {label}
        </span>
        {run.model && (
          <span className="min-w-0 break-all text-description-muted">
            {run.model}
          </span>
        )}
        {tokens > 0 && (
          <span
            className="text-description-muted"
            title={`${run.usage?.inputTokens ?? 0} in, ${run.usage?.outputTokens ?? 0} out, ${run.usage?.cachedTokens ?? 0} read from cache`}
          >
            {formatTokens(tokens)} tokens
          </span>
        )}
        {started && live && (
          <Button
            variant="ghost"
            size="sm"
            className="my-0 ml-auto flex items-center gap-1 text-description"
            onClick={() => stopSubagentRun(id)}
            data-testid={`subagent-stop-${id}`}
            aria-label={`Stop ${run.agent}`}
          >
            <StopIcon className="h-3 w-3" />
            Stop
          </Button>
        )}
      </div>

      {run.notices?.map((notice, i) => (
        <div key={i} className="break-words text-warning">
          {notice}
        </div>
      ))}

      {run.prompt && (
        <div className="flex min-w-0 flex-col gap-1">
          <Disclosure
            label="Prompt"
            open={promptOpen}
            onToggle={() => setPromptOpen((o) => !o)}
            testId={`subagent-prompt-toggle-${id}`}
          />
          {promptOpen && (
            <div
              className="max-h-48 overflow-y-auto pl-4 break-words whitespace-pre-wrap text-description"
              data-testid={`subagent-prompt-${id}`}
            >
              {run.prompt}
            </div>
          )}
        </div>
      )}

      {run.toolCalls.length > 0 && (
        <ul
          className="m-0 flex max-h-40 min-w-0 list-none flex-col gap-0.5 overflow-y-auto p-0"
          data-testid={`subagent-tools-${id}`}
        >
          {run.toolCalls.map((call, i) => (
            <li key={i} className="flex min-w-0 items-start gap-1.5">
              <span className="mt-0.5 flex h-3 w-3 flex-shrink-0 items-center">
                {getStatusIcon(call.status)}
              </span>
              <span className="min-w-0 break-all">
                <span className="font-mono">{call.name}</span>
                {call.summary && (
                  <span className="text-description"> {call.summary}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {run.pendingApproval && (
        <div
          className="flex min-w-0 flex-col gap-1 rounded-sm border border-solid border-input bg-input px-2 py-1"
          data-testid={`subagent-approval-${id}`}
        >
          <span className="break-words">
            <span className="font-semibold">{run.agent}</span> wants to run{" "}
            <span className="font-mono">{run.pendingApproval.toolName}</span>
            {run.pendingApproval.summary && (
              <span className="break-all text-description">
                {" "}
                {run.pendingApproval.summary}
              </span>
            )}
          </span>
          {run.pendingApproval.note && (
            <span className="text-2xs break-words text-warning">
              {run.pendingApproval.note}
            </span>
          )}
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="my-0 text-description-muted"
              onClick={() =>
                answerSubagentApproval(run.pendingApproval!.id, false)
              }
              data-testid={`subagent-reject-${id}`}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="my-0"
              onClick={() =>
                answerSubagentApproval(run.pendingApproval!.id, true)
              }
              data-testid={`subagent-accept-${id}`}
            >
              Allow
            </Button>
          </div>
        </div>
      )}

      {run.error && finished && (
        <div className="break-words text-description">{run.error}</div>
      )}

      {run.text && (
        <div className="flex min-w-0 flex-col gap-1">
          {finished ? (
            <Disclosure
              label={run.status === "completed" ? "Answer" : "Output so far"}
              open={answerOpen}
              onToggle={() => setAnswerOpen((o) => !o)}
              testId={`subagent-answer-toggle-${id}`}
            />
          ) : null}
          {(!finished || answerOpen) && (
            <div
              className={`overflow-y-auto pl-4 break-words whitespace-pre-wrap ${
                finished ? "max-h-80" : "max-h-24 text-description"
              }`}
              data-testid={`subagent-answer-${id}`}
            >
              {run.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
