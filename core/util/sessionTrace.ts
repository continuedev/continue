import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";

import {
  ChatHistoryItem,
  ContextItem,
  Session,
  ToolCallDelta,
} from "../index.js";
import { renderChatMessage, renderContextItems } from "./messageContent.js";
import { getSessionTracesFolderPath } from "./paths.js";

export const SESSION_TRACE_VERSION = 1;
export const SESSION_TRACE_FILE_EXTENSION = ".continue-trace.md";

export type SessionTraceEventType =
  | "user_message"
  | "assistant_message"
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "summary";

type ToolCallState = NonNullable<ChatHistoryItem["toolCallStates"]>[number];

export interface SessionTraceOptions {
  traceCreatedAt?: Date;
}

export interface SessionTraceMetadata {
  traceVersion: number;
  sessionId: string;
  title: string;
  workspaceDirectory: string;
  traceCreatedAt: string;
  messageCount: number;
}

export interface SessionTraceFile {
  filepath: string;
  filename: string;
  metadata: SessionTraceMetadata;
}

interface FormattedToolArgs {
  content: string;
  language?: "json";
}

function formatDate(date: Date): string {
  return date.toISOString();
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function formatFilenameDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function sanitizeFilenameSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled"
  );
}

function countMessages(session: Session): number {
  return session.history.filter((item) =>
    ["user", "assistant", "thinking", "tool"].includes(item.message.role),
  ).length;
}

function frontmatter(session: Session, traceCreatedAt: Date): string {
  return [
    "---",
    `traceVersion: ${SESSION_TRACE_VERSION}`,
    `sessionId: ${yamlString(session.sessionId)}`,
    `title: ${yamlString(session.title)}`,
    `workspaceDirectory: ${yamlString(session.workspaceDirectory)}`,
    `traceCreatedAt: ${yamlString(formatDate(traceCreatedAt))}`,
    `messageCount: ${countMessages(session)}`,
    "---",
  ].join("\n");
}

function heading(
  eventNumber: number,
  eventType: SessionTraceEventType,
  label?: string,
): string {
  const index = String(eventNumber).padStart(3, "0");
  return `## ${index} ${eventType}${label ? `: ${label}` : ""}`;
}

function formatContextItems(contextItems: ContextItem[]): string {
  if (!contextItems.length) {
    return "";
  }

  return [
    "Context:",
    ...contextItems.map((item) => {
      const description = item.description ? ` - ${item.description}` : "";
      return `- ${item.name}${description}`;
    }),
  ].join("\n");
}

function formatToolArgs(value: unknown): FormattedToolArgs | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return {
        content: JSON.stringify(JSON.parse(value), undefined, 2),
        language: "json",
      };
    } catch {
      return { content: value };
    }
  }

  return {
    content: JSON.stringify(value, undefined, 2),
    language: "json",
  };
}

function getToolCallName(toolCallState?: ToolCallState, delta?: ToolCallDelta) {
  return (
    toolCallState?.toolCall.function.name ??
    delta?.function?.name ??
    "unknownTool"
  );
}

function getToolCallId(toolCallState?: ToolCallState, delta?: ToolCallDelta) {
  return toolCallState?.toolCallId ?? delta?.id;
}

function getToolCallArgs(toolCallState?: ToolCallState, delta?: ToolCallDelta) {
  return (
    toolCallState?.processedArgs ??
    toolCallState?.parsedArgs ??
    delta?.function?.arguments
  );
}

function isSuccessfulToolCall(toolCallState?: ToolCallState): string {
  if (!toolCallState) {
    return "unknown";
  }

  if (toolCallState.status === "done") {
    return "true";
  }

  if (["errored", "canceled"].includes(toolCallState.status)) {
    return "false";
  }

  return "unknown";
}

function toolOutputFromContextItems(contextItems: ContextItem[] | undefined) {
  if (!contextItems?.length) {
    return "";
  }

  return renderContextItems(contextItems);
}

function createEvent(
  eventNumber: number,
  eventType: SessionTraceEventType,
  body: string,
  label?: string,
): string {
  const trimmedBody = body.trim();
  return `${heading(eventNumber, eventType, label)}\n\n${trimmedBody}`;
}

function collectToolCallStates(history: ChatHistoryItem[]) {
  const toolCallStates = new Map<string, ToolCallState>();
  for (const item of history) {
    for (const toolCallState of item.toolCallStates ?? []) {
      toolCallStates.set(toolCallState.toolCallId, toolCallState);
    }
  }
  return toolCallStates;
}

function collectToolMessageIds(history: ChatHistoryItem[]) {
  const toolMessageIds = new Set<string>();
  for (const item of history) {
    if (item.message.role === "tool") {
      toolMessageIds.add(item.message.toolCallId);
    }
  }
  return toolMessageIds;
}

export function getSessionTraceFilename(
  session: Pick<Session, "sessionId" | "title">,
  date: Date = new Date(),
): string {
  const timestamp = formatFilenameDate(date);
  const title = sanitizeFilenameSegment(session.title || session.sessionId);
  const shortSessionId = sanitizeFilenameSegment(session.sessionId).slice(0, 8);
  return `${timestamp}-${title}-${shortSessionId}${SESSION_TRACE_FILE_EXTENSION}`;
}

export function parseSessionTraceMetadata(
  traceMarkdown: string,
): SessionTraceMetadata | undefined {
  const frontmatterMatch = traceMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return undefined;
  }

  let metadata: Partial<SessionTraceMetadata>;
  try {
    metadata = YAML.parse(frontmatterMatch[1]) ?? {};
  } catch {
    return undefined;
  }

  if (
    typeof metadata.traceVersion !== "number" ||
    typeof metadata.sessionId !== "string" ||
    typeof metadata.title !== "string" ||
    typeof metadata.workspaceDirectory !== "string" ||
    typeof metadata.traceCreatedAt !== "string" ||
    typeof metadata.messageCount !== "number"
  ) {
    return undefined;
  }

  return {
    traceVersion: metadata.traceVersion,
    sessionId: metadata.sessionId,
    title: metadata.title,
    workspaceDirectory: metadata.workspaceDirectory,
    traceCreatedAt: metadata.traceCreatedAt,
    messageCount: metadata.messageCount,
  };
}

export function listSessionTraceFiles(
  traceDir: string = getSessionTracesFolderPath(),
): SessionTraceFile[] {
  if (!fs.existsSync(traceDir)) {
    return [];
  }

  return fs
    .readdirSync(traceDir)
    .filter((filename) => filename.endsWith(SESSION_TRACE_FILE_EXTENSION))
    .flatMap((filename) => {
      const filepath = path.join(traceDir, filename);
      try {
        const metadata = parseSessionTraceMetadata(
          fs.readFileSync(filepath, "utf8"),
        );
        return metadata ? [{ filepath, filename, metadata }] : [];
      } catch {
        return [];
      }
    })
    .sort((a, b) => {
      const bTime = Date.parse(b.metadata.traceCreatedAt) || 0;
      const aTime = Date.parse(a.metadata.traceCreatedAt) || 0;
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      return a.filename.localeCompare(b.filename);
    });
}

export function sessionToTraceMarkdown(
  session: Session,
  options: SessionTraceOptions = {},
): string {
  const traceCreatedAt = options.traceCreatedAt ?? new Date();
  const toolCallStates = collectToolCallStates(session.history);
  const toolMessageIds = collectToolMessageIds(session.history);
  const events: string[] = [];
  let eventNumber = 1;

  const addEvent = (
    eventType: SessionTraceEventType,
    body: string,
    label?: string,
  ) => {
    events.push(createEvent(eventNumber, eventType, body, label));
    eventNumber += 1;
  };

  for (const item of session.history) {
    const messageText = renderChatMessage(item.message);

    if (item.message.role === "user") {
      const context = formatContextItems(item.contextItems);
      addEvent(
        "user_message",
        [messageText, context].filter(Boolean).join("\n\n"),
      );
    } else if (item.message.role === "assistant") {
      if (messageText.trim()) {
        addEvent("assistant_message", messageText);
      }

      if (item.reasoning?.text.trim()) {
        addEvent("reasoning", item.reasoning.text);
      }

      const toolCallDeltasById = new Map<string, ToolCallDelta>();
      for (const delta of item.message.toolCalls ?? []) {
        if (delta.id) {
          toolCallDeltasById.set(delta.id, delta);
        }
      }

      const toolCallEntries: [ToolCallState | undefined, ToolCallDelta?][] =
        item.toolCallStates?.length
          ? item.toolCallStates.map((state) => [
              state,
              toolCallDeltasById.get(state.toolCallId),
            ])
          : (item.message.toolCalls ?? []).map((delta) => [undefined, delta]);

      for (const [toolCallState, delta] of toolCallEntries) {
        const toolName = getToolCallName(toolCallState, delta);
        const toolCallId = getToolCallId(toolCallState, delta);
        const args = formatToolArgs(getToolCallArgs(toolCallState, delta));
        const argsFence = args
          ? `Args:\n\n\`\`\`${args.language ?? ""}\n${args.content}\n\`\`\``
          : "";

        addEvent(
          "tool_call",
          [toolCallId ? `Tool Call ID: ${toolCallId}` : "", argsFence]
            .filter(Boolean)
            .join("\n\n"),
          toolName,
        );

        const output = toolOutputFromContextItems(toolCallState?.output);
        if (toolCallId && output && !toolMessageIds.has(toolCallId)) {
          addEvent(
            "tool_result",
            [
              `Success: ${isSuccessfulToolCall(toolCallState)}`,
              `Output:\n${output}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
            toolName,
          );
        }
      }
    } else if (item.message.role === "thinking") {
      addEvent(
        "reasoning",
        item.message.redactedThinking ? "[redacted]" : messageText,
      );
    } else if (item.message.role === "tool") {
      const toolCallState = toolCallStates.get(item.message.toolCallId);
      const toolName = getToolCallName(toolCallState);
      addEvent(
        "tool_result",
        [
          `Tool Call ID: ${item.message.toolCallId}`,
          `Success: ${isSuccessfulToolCall(toolCallState)}`,
          `Output:\n${messageText}`,
        ].join("\n\n"),
        toolName,
      );
    }

    if (item.conversationSummary?.trim()) {
      addEvent("summary", item.conversationSummary);
    }
  }

  return [
    frontmatter(session, traceCreatedAt),
    "",
    `# Session: ${session.title}`,
    "",
    ...events.flatMap((event) => [event, ""]),
  ]
    .join("\n")
    .trimEnd();
}
