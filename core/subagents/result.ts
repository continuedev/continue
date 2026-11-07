import type { ToolStatus } from "..";

/**
 * The same shapes and rules as the CLI's subagent result
 * (extensions/cli/src/subagent/transcript.ts and result.ts): the parent reads
 * the answer and a `<task_metadata>` block, never tool output.
 */
export type SubagentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial" // stopped at its turn limit
  | "failed"
  | "cancelled"
  | "interrupted"; // the window reloaded while it ran

export const FINISHED_SUBAGENT_STATUSES: SubagentRunStatus[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
  "interrupted",
];

export function isSubagentRunFinished(status: SubagentRunStatus): boolean {
  return FINISHED_SUBAGENT_STATUSES.includes(status);
}

/** One tool call a subagent made, without its output. */
export interface SubagentToolCallSummary {
  name: string;
  /** The call's main argument (path, command, pattern...), shortened. */
  summary: string;
  status: ToolStatus;
}

const SUMMARY_KEYS = [
  "command",
  "filepath",
  "file_path",
  "path",
  "pattern",
  "query",
  "url",
  "dirPath",
  "description",
];
const SUMMARY_LENGTH = 80;

function shorten(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** The argument that says what a call is about, or "" when none does. */
export function summarizeToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  const key =
    SUMMARY_KEYS.find((k) => typeof record[k] === "string") ??
    Object.keys(record).find((k) => typeof record[k] === "string");
  return key ? shorten(String(record[key]), SUMMARY_LENGTH) : "";
}

/**
 * Tag names that harnesses use to frame what the model reads: snake_case or
 * kebab-case names such as `task_metadata` or `system-reminder`, plus a few
 * plain ones. Ordinary code (`Array<string>`, `<div>`) does not match.
 */
const HARNESS_TAG =
  /<\s*(\/?)\s*((?:[a-z][a-z0-9]*[_-][a-z0-9_-]*)|system|user|assistant|tool|instructions|metadata)\b([^>]*)>/gi;

/**
 * Subagent output is untrusted data. Text in it that imitates the tags the
 * result is framed with (or other harness tags) could make the parent read
 * part of the output as metadata or instructions, so those tags are escaped.
 */
export function neutralizeHarnessTags(text: string): string {
  return text.replace(HARNESS_TAG, "&lt;$1$2$3&gt;");
}

export function formatToolCall(call: SubagentToolCallSummary): string {
  return `${call.name}${call.summary ? ` ${call.summary}` : ""} (${call.status})`;
}

export interface SubagentResultInput {
  agent: string;
  status: SubagentRunStatus;
  /** The final answer, or everything written so far when it did not finish. */
  response: string;
  /** Why the run did not complete. */
  error?: string;
  toolCalls: SubagentToolCallSummary[];
}

/**
 * What the parent model reads back from a subagent: its answer (or what it
 * wrote before it stopped), then the run's status, the reason it did not
 * complete, and the tools it used by name. Tool output is never included,
 * and tags in the subagent's text that imitate the ones framing the result
 * are escaped, since that text is untrusted data.
 */
export function formatSubagentResult(result: SubagentResultInput): string {
  const response = neutralizeHarnessTags(result.response.trim());
  const metadata = [
    `agent: ${neutralizeHarnessTags(result.agent)}`,
    `status: ${result.status}`,
  ];
  if (result.error) {
    metadata.push(`reason: ${neutralizeHarnessTags(result.error)}`);
  }
  if (result.toolCalls.length > 0) {
    metadata.push(`tool calls (${result.toolCalls.length}):`);
    for (const call of result.toolCalls) {
      metadata.push(`- ${neutralizeHarnessTags(formatToolCall(call))}`);
    }
  }
  return [
    response || "(the subagent returned no text)",
    "<task_metadata>",
    ...metadata,
    "</task_metadata>",
  ].join("\n");
}
