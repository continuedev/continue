import type { ToolStatus } from "core/index.js";

export type SubAgentStatus = "completed" | "partial" | "failed" | "cancelled";

/** One tool call the subagent made, without its output. */
export interface SubAgentToolCall {
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

/**
 * Collects what a subagent run produces from the stream callbacks: the
 * assistant's text, split at tool calls, and the tool calls themselves. Tool
 * output is never kept, so it cannot reach the parent's context.
 */
export class SubAgentTranscript {
  private segments: string[] = [];
  private current = "";
  private lastEventWasTool = false;
  readonly toolCalls: SubAgentToolCall[] = [];
  readonly notices: string[] = [];

  constructor(private readonly onUpdate?: (rendered: string) => void) {}

  onContent(content: string): void {
    this.current += content;
    this.lastEventWasTool = false;
    this.emit();
  }

  onToolStart(name: string, args?: unknown): void {
    this.endSegment();
    this.lastEventWasTool = true;
    this.toolCalls.push({
      name,
      summary: summarizeToolArgs(args),
      status: "calling",
    });
    this.emit();
  }

  onToolResult(name: string, status: ToolStatus): void {
    const call = [...this.toolCalls]
      .reverse()
      .find((c) => c.name === name && c.status === "calling");
    if (call) call.status = status;
    this.lastEventWasTool = true;
    this.emit();
  }

  /** Something the person should see in the run's progress, not the parent. */
  notice(text: string): void {
    this.notices.push(text);
    this.emit();
  }

  /** A new turn starts (a SubagentStop hook sent the subagent back to work). */
  newTurn(): void {
    this.endSegment();
  }

  /** The text after the last tool call: the subagent's answer, if it gave one. */
  finalAnswer(): string {
    return this.lastEventWasTool ? "" : this.current.trim();
  }

  /** Everything the subagent wrote, without tool output. */
  allText(): string {
    return [...this.segments, this.current.trim()].filter(Boolean).join("\n\n");
  }

  /** Progress for the parent's UI: notices, tool lines and the text so far. */
  render(): string {
    const lines = [
      ...this.notices,
      ...this.toolCalls.map((c) => `- ${formatToolCall(c)}`),
    ];
    const text = this.allText();
    return [lines.join("\n"), text].filter(Boolean).join("\n\n");
  }

  private endSegment(): void {
    const text = this.current.trim();
    if (text) this.segments.push(text);
    this.current = "";
  }

  private emit(): void {
    this.onUpdate?.(this.render());
  }
}

export function formatToolCall(call: SubAgentToolCall): string {
  return `${call.name}${call.summary ? ` ${call.summary}` : ""} (${call.status})`;
}
