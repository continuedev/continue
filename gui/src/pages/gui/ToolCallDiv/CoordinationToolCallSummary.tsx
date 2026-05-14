import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { ContextItem, ToolCall, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { IIdeMessenger } from "../../../context/IdeMessenger";

const SUMMARY_LINE_LIMIT = 4;
const TRANSCRIPT_SUBAGENT_DELEGATE_SOURCE = "panel_subagent_delegate";

interface TeamMailboxSummaryMessage {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  summary?: string;
  kind: "prompt" | "message" | "control";
  read: boolean;
  readAt?: string;
  readSource?: string;
  readBy?: string;
}

interface TeamMailboxSummaryMetadata {
  teamName: string;
  mailboxOwner: string;
  totalMessages: number;
  unreadCount: number;
  truncated: boolean;
  messages: TeamMailboxSummaryMessage[];
}

interface TeamMemberSummary {
  name: string;
  subagentName?: string;
}

const COORDINATION_SUMMARY_TOOLS = new Set<string>([
  BuiltInToolNames.Subagent,
  BuiltInToolNames.Config,
  BuiltInToolNames.Status,
  BuiltInToolNames.TeamCreate,
  BuiltInToolNames.TeamDelete,
  BuiltInToolNames.TeamStatus,
  BuiltInToolNames.TeamMailbox,
  BuiltInToolNames.SendMessage,
]);

function asText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function getSummaryBadges(toolCallState: ToolCallState): string[] {
  const functionName = toolCallState.toolCall.function?.name;
  const args = (toolCallState.parsedArgs ?? {}) as Record<string, unknown>;

  switch (functionName) {
    case BuiltInToolNames.Subagent:
      return [
        asText(args.subagent_name) ? `agent ${args.subagent_name}` : undefined,
        asText(args.team_name) ? `team ${args.team_name}` : undefined,
        asText(args.teammate_name) ? `mate ${args.teammate_name}` : undefined,
        asText(args.profile) ? `profile ${args.profile}` : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.Config:
      return [asText(args.setting) ? `setting ${args.setting}` : "config"];
    case BuiltInToolNames.Status:
      return ["runtime status"];
    case BuiltInToolNames.TeamCreate:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "create team",
      ];
    case BuiltInToolNames.TeamDelete:
      return [
        asText(args.team_name)
          ? `delete ${args.team_name}`
          : "delete active team",
      ];
    case BuiltInToolNames.TeamStatus:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "active team",
        args.include_mailbox === true ? "with mailbox" : undefined,
        asText(args.member_name) ? `member ${args.member_name}` : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.TeamMailbox:
      return [
        asText(args.team_name) ? `team ${args.team_name}` : "active team",
        asText(args.member_name)
          ? `mailbox ${args.member_name}`
          : "mailbox team-lead",
        args.unread_only === true ? "unread only" : undefined,
        args.mark_read === true ? "mark read" : undefined,
      ].filter((value): value is string => Boolean(value));
    case BuiltInToolNames.SendMessage:
      return [
        asText(args.from) ? `from ${args.from}` : "from team-lead",
        asText(args.to) ? `to ${args.to}` : undefined,
        asText(args.kind) ? `kind ${args.kind}` : undefined,
      ].filter((value): value is string => Boolean(value));
    default:
      return [];
  }
}

function buildToolCall(
  functionName: string,
  args: Record<string, unknown>,
): ToolCall {
  return {
    id: `coordination-summary-${functionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "function",
    function: {
      name: functionName,
      arguments: JSON.stringify(args),
    },
  };
}

async function callCoordinationTool(args: {
  ideMessenger: IIdeMessenger;
  sessionId: string;
  functionName: string;
  toolArgs: Record<string, unknown>;
}): Promise<ContextItem[]> {
  const result = await args.ideMessenger.request("tools/call", {
    toolCall: buildToolCall(args.functionName, args.toolArgs),
    sessionId: args.sessionId,
  });

  if (result.status === "error") {
    throw new Error(result.error);
  }

  if (result.content.errorMessage) {
    throw new Error(result.content.errorMessage);
  }

  return result.content.contextItems;
}

async function extractCoordinationToolContextItem(args: {
  ideMessenger: IIdeMessenger;
  sessionId: string;
  functionName: string;
  toolArgs: Record<string, unknown>;
  expectedName: string;
}): Promise<ContextItem | null> {
  const contextItems = await callCoordinationTool(args);
  const contextItem =
    contextItems.find((item) => item.name === args.expectedName) ??
    contextItems[0];

  if (!contextItem || contextItem.name !== args.expectedName) {
    return null;
  }

  return contextItem;
}

function parseTeamMembers(content: string | undefined): TeamMemberSummary[] {
  if (!content) {
    return [];
  }

  const members = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line): TeamMemberSummary | null => {
      const match = line.match(/^\-\s+([^:(]+?)(?:\s+\(([^)]*)\))?:/);
      if (!match?.[1]) {
        return null;
      }

      return {
        name: match[1].trim(),
        subagentName: match[2]?.trim() || undefined,
      };
    })
    .filter((member): member is TeamMemberSummary => member !== null);

  return Array.from(
    new Map(members.map((member) => [member.name, member])).values(),
  );
}

function buildMailboxDelegationPrompt(args: {
  teamName: string;
  mailboxOwner: string;
  message: TeamMailboxSummaryMessage;
}): string {
  return [
    `Handle this mailbox handoff for ${args.mailboxOwner} in team ${args.teamName}.`,
    `Sender: ${args.message.from}`,
    `Kind: ${args.message.kind}`,
    `Received: ${args.message.timestamp}`,
    asText(args.message.summary)
      ? `Summary: ${args.message.summary}`
      : undefined,
    "",
    "Mailbox task:",
    args.message.text,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function isTeamMailboxSummaryMessage(
  value: unknown,
): value is TeamMailboxSummaryMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.from === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.timestamp === "string" &&
    (candidate.kind === "prompt" ||
      candidate.kind === "message" ||
      candidate.kind === "control") &&
    typeof candidate.read === "boolean"
  );
}

function getTeamMailboxSummaryMetadata(
  toolCallState: ToolCallState,
): TeamMailboxSummaryMetadata | null {
  return getTeamMailboxSummaryMetadataFromContextItem(
    (toolCallState.output ?? []).find((item) => item.name === "Team Mailbox"),
  );
}

function getTeamMailboxSummaryMetadataFromContextItem(
  mailboxItem: ContextItem | null | undefined,
): TeamMailboxSummaryMetadata | null {
  const metadata = mailboxItem?.metadata;

  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  if (
    typeof record.teamName !== "string" ||
    typeof record.mailboxOwner !== "string" ||
    typeof record.totalMessages !== "number" ||
    typeof record.unreadCount !== "number" ||
    typeof record.truncated !== "boolean" ||
    !Array.isArray(record.messages)
  ) {
    return null;
  }

  return {
    teamName: record.teamName,
    mailboxOwner: record.mailboxOwner,
    totalMessages: record.totalMessages,
    unreadCount: record.unreadCount,
    truncated: record.truncated,
    messages: record.messages.filter(isTeamMailboxSummaryMessage),
  };
}

function formatMailboxMessageStatus(
  message: TeamMailboxSummaryMessage,
): string {
  if (!message.read) {
    return "Unread";
  }

  const isConsumed =
    message.readSource === "subagent" ||
    message.readSource === "panel_subagent_delegate";
  const actor = asText(message.readBy);
  const timestamp = asText(message.readAt);
  const base = isConsumed
    ? actor
      ? `Consumed by ${actor}`
      : "Consumed"
    : actor
      ? `Read by ${actor}`
      : "Read";

  return timestamp ? `${base} at ${timestamp}` : base;
}

function getStructuredMailboxOutputLines(
  metadata: TeamMailboxSummaryMetadata | null,
): string[] {
  if (!metadata || metadata.messages.length === 0) {
    return [];
  }

  const lines = metadata.messages.flatMap((message) => [
    `[${message.kind}] ${message.from}${
      asText(message.summary) ? ` -- ${message.summary}` : ""
    }`,
    formatMailboxMessageStatus(message),
    message.text.trim(),
  ]);

  if (metadata.truncated) {
    lines.push(
      `Showing ${metadata.messages.length} of ${metadata.totalMessages} message(s).`,
    );
  }

  return lines.filter(Boolean);
}

function getOutputLines(
  toolCallState: ToolCallState,
  mailboxMetadataOverride?: TeamMailboxSummaryMetadata | null,
): string[] {
  if (toolCallState.toolCall.function?.name === BuiltInToolNames.TeamMailbox) {
    const structuredMailboxLines = getStructuredMailboxOutputLines(
      mailboxMetadataOverride ?? getTeamMailboxSummaryMetadata(toolCallState),
    );
    if (structuredMailboxLines.length > 0) {
      return structuredMailboxLines;
    }
  }

  return (toolCallState.output ?? [])
    .flatMap((item) => item.content.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isCoordinationSummaryTool(functionName?: string): boolean {
  return Boolean(functionName && COORDINATION_SUMMARY_TOOLS.has(functionName));
}

export function CoordinationToolCallSummary({
  toolCallState,
  sessionId,
  ideMessenger,
}: {
  toolCallState: ToolCallState;
  sessionId?: string;
  ideMessenger?: IIdeMessenger;
}) {
  const derivedMailboxMetadata = useMemo(
    () => getTeamMailboxSummaryMetadata(toolCallState),
    [toolCallState.output],
  );
  const [mailboxMetadataOverride, setMailboxMetadataOverride] =
    useState<TeamMailboxSummaryMetadata | null>(null);
  const [delegateResults, setDelegateResults] = useState<
    Record<string, string>
  >({});
  const [delegationError, setDelegationError] = useState<string | null>(null);
  const [delegatingMessageId, setDelegatingMessageId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setMailboxMetadataOverride(null);
    setDelegateResults({});
    setDelegationError(null);
    setDelegatingMessageId(null);
  }, [toolCallState.output, toolCallState.toolCallId]);

  const mailboxMetadata = mailboxMetadataOverride ?? derivedMailboxMetadata;
  const badges = getSummaryBadges(toolCallState);
  const outputLines = getOutputLines(toolCallState, mailboxMetadata);
  const previewLines = outputLines.slice(0, SUMMARY_LINE_LIMIT);
  const remainingLineCount = Math.max(
    0,
    outputLines.length - previewLines.length,
  );
  const waitingForOutput =
    toolCallState.status === "generating" ||
    toolCallState.status === "generated" ||
    toolCallState.status === "calling";
  const delegateableMessages =
    toolCallState.toolCall.function?.name === BuiltInToolNames.TeamMailbox
      ? (mailboxMetadata?.messages ?? []).filter(
          (message) =>
            !message.read &&
            (message.kind === "prompt" || message.kind === "control"),
        )
      : [];

  const handleDelegateMessage = useCallback(
    async (message: TeamMailboxSummaryMessage) => {
      if (!sessionId || !ideMessenger || !mailboxMetadata) {
        return;
      }

      setDelegatingMessageId(message.id);
      setDelegationError(null);

      try {
        const claimedMailboxItem = await extractCoordinationToolContextItem({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.TeamMailbox,
          toolArgs: {
            team_name: mailboxMetadata.teamName,
            member_name: mailboxMetadata.mailboxOwner,
            unread_only: true,
            mark_read: true,
            message_ids: [message.id],
            read_source: TRANSCRIPT_SUBAGENT_DELEGATE_SOURCE,
            read_by: mailboxMetadata.mailboxOwner,
            max_messages: 1,
          },
          expectedName: "Team Mailbox",
        });
        const claimedMetadata =
          getTeamMailboxSummaryMetadataFromContextItem(claimedMailboxItem);
        const claimedMessage = claimedMetadata?.messages.find(
          (candidate) => candidate.id === message.id,
        );

        setMailboxMetadataOverride((current) => {
          const base = current ?? mailboxMetadata;
          if (!base) {
            return current;
          }

          const wasUnread = base.messages.some(
            (candidate) => candidate.id === message.id && !candidate.read,
          );

          return {
            ...base,
            unreadCount: wasUnread
              ? Math.max(0, base.unreadCount - 1)
              : base.unreadCount,
            messages: base.messages.map((candidate) =>
              candidate.id === message.id
                ? (claimedMessage ?? {
                    ...candidate,
                    read: true,
                    readSource: TRANSCRIPT_SUBAGENT_DELEGATE_SOURCE,
                    readBy: mailboxMetadata.mailboxOwner,
                  })
                : candidate,
            ),
          };
        });

        const teamStatusItem = await extractCoordinationToolContextItem({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.TeamStatus,
          toolArgs: {
            team_name: mailboxMetadata.teamName,
          },
          expectedName: "Team Status",
        });
        const selectedMember = parseTeamMembers(teamStatusItem?.content).find(
          (member) => member.name === mailboxMetadata.mailboxOwner,
        );

        const subagentArgs: Record<string, unknown> = {
          description:
            asText(message.summary) ??
            `Handle ${message.kind} mailbox item for ${mailboxMetadata.mailboxOwner}`,
          prompt: buildMailboxDelegationPrompt({
            teamName: mailboxMetadata.teamName,
            mailboxOwner: mailboxMetadata.mailboxOwner,
            message,
          }),
          team_name: mailboxMetadata.teamName,
          teammate_name: mailboxMetadata.mailboxOwner,
          profile: "coordinator-worker",
        };

        if (selectedMember?.subagentName) {
          subagentArgs.subagent_name = selectedMember.subagentName;
        }

        const subagentItems = await callCoordinationTool({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.Subagent,
          toolArgs: subagentArgs,
        });
        const resultItem =
          subagentItems.find((item) => item.name === "Subagent Result") ??
          subagentItems[subagentItems.length - 1];

        if (resultItem) {
          setDelegateResults((current) => ({
            ...current,
            [message.id]: resultItem.content,
          }));
        }
      } catch (error) {
        setDelegationError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setDelegatingMessageId(null);
      }
    },
    [ideMessenger, mailboxMetadata, sessionId],
  );

  return (
    <div
      className="border-border mt-1 flex flex-col gap-2 rounded-md border px-3 py-2"
      data-testid={`coordination-tool-summary-${toolCallState.toolCallId}`}
    >
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge}
              className="bg-vsc-input-background text-description rounded-full px-2 py-0.5 text-[11px]"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="text-description flex flex-col gap-1 text-xs">
        {previewLines.length > 0 ? (
          previewLines.map((line, index) => (
            <div
              key={`${toolCallState.toolCallId}-${index}`}
              className="line-clamp-2 whitespace-pre-wrap break-words"
            >
              {line}
            </div>
          ))
        ) : (
          <div className="italic">
            {waitingForOutput
              ? "Waiting for tool output..."
              : "No tool output."}
          </div>
        )}

        {remainingLineCount > 0 && (
          <div className="italic">+{remainingLineCount} more line(s)</div>
        )}

        {delegateableMessages.length > 0 && sessionId && ideMessenger && (
          <div className="mt-1 flex flex-wrap gap-2">
            {delegateableMessages.map((message) => {
              const label = asText(message.summary) ?? message.kind;
              const isDelegating = delegatingMessageId === message.id;

              return (
                <Button
                  key={message.id}
                  variant="outline"
                  size="sm"
                  className="my-0 px-2 py-1 text-[11px]"
                  data-testid={`coordination-mailbox-delegate-${toolCallState.toolCallId}-${message.id}`}
                  disabled={Boolean(delegatingMessageId)}
                  onClick={() => void handleDelegateMessage(message)}
                >
                  <span className="flex items-center gap-1">
                    <PaperAirplaneIcon className="h-3.5 w-3.5" />
                    {isDelegating ? "Delegating..." : `Delegate ${label}`}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {delegationError && (
          <div
            className="text-error whitespace-pre-wrap break-words"
            data-testid={`coordination-mailbox-delegate-error-${toolCallState.toolCallId}`}
          >
            {delegationError}
          </div>
        )}

        {Object.entries(delegateResults).map(([messageId, content]) => (
          <div
            key={messageId}
            className="whitespace-pre-wrap break-words"
            data-testid={`coordination-mailbox-delegate-result-${toolCallState.toolCallId}-${messageId}`}
          >
            {content}
          </div>
        ))}
      </div>
    </div>
  );
}
