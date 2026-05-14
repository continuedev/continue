import {
  ArrowPathIcon,
  EnvelopeOpenIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { ContextItem, ToolCall } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "../../components/ui/Button";
import { IdeMessengerContext, IIdeMessenger } from "../../context/IdeMessenger";
import { useAppSelector } from "../../redux/hooks";

const TEAM_PANEL_POLL_INTERVAL_MS = 10000;
const NO_ACTIVE_TEAM_MESSAGE = "No active team exists for this session.";
const DEFAULT_MAILBOX_OWNER = "team-lead";

interface CoordinationPanelSnapshot {
  teamStatus: ContextItem;
  mailbox: ContextItem | null;
  teamMembers: TeamMemberSummary[];
}

interface TeamMemberSummary {
  name: string;
  subagentName?: string;
}

interface MailboxMessageSummary {
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

interface TeamMailboxMetadata {
  teamName: string;
  mailboxOwner: string;
  totalMessages: number;
  unreadCount: number;
  truncated: boolean;
  messages: MailboxMessageSummary[];
}

function buildToolCall(
  functionName: string,
  args: Record<string, unknown>,
): ToolCall {
  return {
    id: `coordination-panel-${functionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: "function",
    function: {
      name: functionName,
      arguments: JSON.stringify(args),
    },
  };
}

function isNoActiveTeamError(message?: string): boolean {
  return Boolean(message?.includes(NO_ACTIVE_TEAM_MESSAGE));
}

function getUnreadCount(content: string | undefined): number {
  if (!content) {
    return 0;
  }

  const match = content.match(/\((\d+) message\(s\)\):/);
  return match ? Number(match[1]) : 0;
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

function resolveMailboxOwner(
  teamMembers: TeamMemberSummary[],
  preferredMailboxOwner: string,
): string {
  if (teamMembers.some((member) => member.name === preferredMailboxOwner)) {
    return preferredMailboxOwner;
  }

  if (teamMembers.some((member) => member.name === DEFAULT_MAILBOX_OWNER)) {
    return DEFAULT_MAILBOX_OWNER;
  }

  return teamMembers[0]?.name ?? DEFAULT_MAILBOX_OWNER;
}

function isMailboxMessageSummary(
  value: unknown,
): value is MailboxMessageSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.from === "string" &&
    typeof candidate.text === "string" &&
    typeof candidate.timestamp === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.read === "boolean"
  );
}

function getMailboxMetadata(
  contextItem: ContextItem | null | undefined,
): TeamMailboxMetadata | null {
  const metadata = contextItem?.metadata;
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
    messages: record.messages.filter(isMailboxMessageSummary),
  };
}

function getMessageStatusLabel(message: MailboxMessageSummary): string {
  if (!message.read) {
    return "Unread";
  }

  if (
    message.readSource === "subagent" ||
    message.readSource === "panel_subagent_delegate"
  ) {
    return message.readBy ? `Consumed by ${message.readBy}` : "Consumed";
  }

  return "Read";
}

function getMessageStatusDetail(message: MailboxMessageSummary): string | null {
  if (!message.readAt) {
    return null;
  }

  return `${getMessageStatusLabel(message)} at ${message.readAt}`;
}

function buildMailboxDelegationPrompt(args: {
  teamName: string;
  mailboxOwner: string;
  message: MailboxMessageSummary;
}): string {
  return [
    `Handle this mailbox handoff for ${args.mailboxOwner} in team ${args.teamName}.`,
    `Sender: ${args.message.from}`,
    `Kind: ${args.message.kind}`,
    `Received: ${args.message.timestamp}`,
    args.message.summary ? `Summary: ${args.message.summary}` : undefined,
    "",
    "Mailbox task:",
    args.message.text,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function callTool(args: {
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

async function extractToolContextItem(args: {
  ideMessenger: IIdeMessenger;
  sessionId: string;
  functionName: string;
  toolArgs: Record<string, unknown>;
  expectedName: string;
}): Promise<ContextItem | null> {
  const contextItems = await callTool(args);
  const contextItem =
    contextItems.find((item) => item.name === args.expectedName) ??
    contextItems[0];
  if (!contextItem || contextItem.name !== args.expectedName) {
    return null;
  }

  return contextItem;
}

export function TeamCoordinationPanel() {
  const ideMessenger = useContext(IdeMessengerContext);
  const sessionId = useAppSelector((state) => state.session.id);
  const selectedMailboxOwnerRef = useRef(DEFAULT_MAILBOX_OWNER);
  const [snapshot, setSnapshot] = useState<CoordinationPanelSnapshot | null>(
    null,
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDelegatingMessageId, setIsDelegatingMessageId] = useState<
    string | null
  >(null);
  const [lastDelegatedResult, setLastDelegatedResult] = useState<{
    messageId: string;
    content: string;
  } | null>(null);
  const [selectedMailboxOwner, setSelectedMailboxOwner] = useState(
    DEFAULT_MAILBOX_OWNER,
  );
  const mailboxMetadata = useMemo(
    () => getMailboxMetadata(snapshot?.mailbox),
    [snapshot?.mailbox],
  );
  const unreadCount = useMemo(
    () =>
      mailboxMetadata?.unreadCount ??
      getUnreadCount(snapshot?.mailbox?.content),
    [mailboxMetadata?.unreadCount, snapshot?.mailbox?.content],
  );

  const refreshPanel = useCallback(
    async (preferredMailboxOwner?: string) => {
      if (!sessionId) {
        setSnapshot(null);
        setHasLoaded(true);
        setError(null);
        setLastDelegatedResult(null);
        selectedMailboxOwnerRef.current = DEFAULT_MAILBOX_OWNER;
        setSelectedMailboxOwner(DEFAULT_MAILBOX_OWNER);
        return;
      }

      setIsRefreshing(true);
      try {
        const teamStatus = await extractToolContextItem({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.TeamStatus,
          toolArgs: {},
          expectedName: "Team Status",
        });

        if (!teamStatus) {
          setSnapshot(null);
          setError(null);
          selectedMailboxOwnerRef.current = DEFAULT_MAILBOX_OWNER;
          setSelectedMailboxOwner(DEFAULT_MAILBOX_OWNER);
          setLastDelegatedResult(null);
        } else {
          const teamMembers = parseTeamMembers(teamStatus.content);
          const mailboxOwner = resolveMailboxOwner(
            teamMembers,
            preferredMailboxOwner ?? selectedMailboxOwnerRef.current,
          );
          const mailbox = await extractToolContextItem({
            ideMessenger,
            sessionId,
            functionName: BuiltInToolNames.TeamMailbox,
            toolArgs: {
              unread_only: true,
              member_name: mailboxOwner,
              max_messages: 5,
            },
            expectedName: "Team Mailbox",
          });

          selectedMailboxOwnerRef.current = mailboxOwner;
          setSelectedMailboxOwner(mailboxOwner);
          setSnapshot({
            teamStatus,
            mailbox,
            teamMembers,
          });
          setError(null);
        }
      } catch (refreshError) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : String(refreshError);
        if (isNoActiveTeamError(message)) {
          setSnapshot(null);
          setError(null);
          setLastDelegatedResult(null);
          selectedMailboxOwnerRef.current = DEFAULT_MAILBOX_OWNER;
          setSelectedMailboxOwner(DEFAULT_MAILBOX_OWNER);
        } else {
          setError(message);
        }
      } finally {
        setHasLoaded(true);
        setIsRefreshing(false);
      }
    },
    [ideMessenger, sessionId],
  );

  const handleMarkRead = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsRefreshing(true);
    try {
      await extractToolContextItem({
        ideMessenger,
        sessionId,
        functionName: BuiltInToolNames.TeamMailbox,
        toolArgs: {
          unread_only: true,
          mark_read: true,
          member_name: selectedMailboxOwnerRef.current,
          max_messages: 20,
        },
        expectedName: "Team Mailbox",
      });
      await refreshPanel(selectedMailboxOwnerRef.current);
    } catch (markReadError) {
      const message =
        markReadError instanceof Error
          ? markReadError.message
          : String(markReadError);
      if (isNoActiveTeamError(message)) {
        setSnapshot(null);
        setError(null);
      } else {
        setError(message);
      }
      setIsRefreshing(false);
    }
  }, [ideMessenger, refreshPanel, sessionId]);

  const handleMailboxOwnerChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextMailboxOwner = event.target.value;
      selectedMailboxOwnerRef.current = nextMailboxOwner;
      setSelectedMailboxOwner(nextMailboxOwner);
      setLastDelegatedResult(null);
      void refreshPanel(nextMailboxOwner);
    },
    [refreshPanel],
  );

  const handleDelegateMessage = useCallback(
    async (message: MailboxMessageSummary) => {
      if (!sessionId || !snapshot) {
        return;
      }

      const teamName =
        mailboxMetadata?.teamName ??
        snapshot.teamStatus.description.replace(/^Team\s+/, "").trim();
      const selectedMember = snapshot.teamMembers.find(
        (member) => member.name === selectedMailboxOwnerRef.current,
      );

      setIsDelegatingMessageId(message.id);
      setError(null);
      setLastDelegatedResult(null);

      try {
        await callTool({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.TeamMailbox,
          toolArgs: {
            unread_only: true,
            mark_read: true,
            member_name: selectedMailboxOwnerRef.current,
            message_ids: [message.id],
            read_source: "panel_subagent_delegate",
            read_by: selectedMailboxOwnerRef.current,
            max_messages: 1,
          },
        });

        const subagentArgs: Record<string, unknown> = {
          description:
            message.summary ??
            `Handle ${message.kind} mailbox item for ${selectedMailboxOwnerRef.current}`,
          prompt: buildMailboxDelegationPrompt({
            teamName,
            mailboxOwner: selectedMailboxOwnerRef.current,
            message,
          }),
          team_name: teamName,
          teammate_name: selectedMailboxOwnerRef.current,
          profile: "coordinator-worker",
        };

        if (selectedMember?.subagentName) {
          subagentArgs.subagent_name = selectedMember.subagentName;
        }

        const subagentItems = await callTool({
          ideMessenger,
          sessionId,
          functionName: BuiltInToolNames.Subagent,
          toolArgs: subagentArgs,
        });
        const resultItem =
          subagentItems.find((item) => item.name === "Subagent Result") ??
          subagentItems[subagentItems.length - 1];

        if (resultItem) {
          setLastDelegatedResult({
            messageId: message.id,
            content: resultItem.content,
          });
        }

        await refreshPanel(selectedMailboxOwnerRef.current);
      } catch (delegateError) {
        setError(
          delegateError instanceof Error
            ? delegateError.message
            : String(delegateError),
        );
        await refreshPanel(selectedMailboxOwnerRef.current);
      } finally {
        setIsDelegatingMessageId(null);
      }
    },
    [
      ideMessenger,
      mailboxMetadata?.teamName,
      refreshPanel,
      sessionId,
      snapshot,
    ],
  );

  useEffect(() => {
    void refreshPanel();

    const interval = window.setInterval(() => {
      void refreshPanel();
    }, TEAM_PANEL_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refreshPanel]);

  if (!hasLoaded || !snapshot) {
    return null;
  }

  return (
    <div
      className="border-command-border bg-vsc-editor-background mx-2 mb-2 rounded-xl border border-solid px-3 py-3"
      data-testid="team-coordination-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Team coordination</div>
          <div className="text-description mt-1 text-xs">
            Inspect the active session team and the lead mailbox without relying
            on transcript tool cards.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="my-0 px-2 py-1 text-xs"
            data-testid="team-coordination-refresh"
            disabled={isRefreshing}
            onClick={() => void refreshPanel(selectedMailboxOwnerRef.current)}
          >
            <span className="flex items-center gap-1">
              <ArrowPathIcon
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="my-0 px-2 py-1 text-xs"
            data-testid="team-coordination-mark-read"
            disabled={isRefreshing || unreadCount === 0}
            onClick={() => void handleMarkRead()}
          >
            <span className="flex items-center gap-1">
              <EnvelopeOpenIcon className="h-3.5 w-3.5" />
              Mark read
            </span>
          </Button>
        </div>
      </div>

      {error ? (
        <div
          className="text-error mt-3 text-xs"
          data-testid="team-coordination-error"
        >
          {error}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="border-command-border bg-vsc-input-background rounded-lg border border-solid px-3 py-2">
            <div className="text-xs font-semibold">Team status</div>
            <pre className="text-description mt-2 whitespace-pre-wrap break-words text-xs font-normal">
              {snapshot.teamStatus.content}
            </pre>
          </div>
          <div className="border-command-border bg-vsc-input-background rounded-lg border border-solid px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="text-xs font-semibold">Mailbox</div>
                <select
                  className="bg-vsc-editor-background border-command-border text-description rounded-md border px-2 py-1 text-[11px]"
                  data-testid="team-coordination-mailbox-owner"
                  disabled={isRefreshing || Boolean(isDelegatingMessageId)}
                  onChange={handleMailboxOwnerChange}
                  value={selectedMailboxOwner}
                >
                  {snapshot.teamMembers.map((member) => (
                    <option key={member.name} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-description text-[11px]">
                {unreadCount} unread
              </div>
            </div>
            {mailboxMetadata && mailboxMetadata.messages.length > 0 ? (
              <div
                className="mt-2 space-y-2"
                data-testid="team-coordination-mailbox-messages"
              >
                {mailboxMetadata.messages.map((message) => {
                  const isDelegating = isDelegatingMessageId === message.id;
                  const canDelegate =
                    !message.read &&
                    (message.kind === "prompt" || message.kind === "control");
                  const statusDetail = getMessageStatusDetail(message);

                  return (
                    <div
                      key={message.id}
                      className="border-command-border rounded-lg border border-solid px-2 py-2"
                      data-testid={`team-coordination-message-${message.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                            <span>{message.kind}</span>
                            {message.summary ? (
                              <span>{message.summary}</span>
                            ) : null}
                          </div>
                          <div className="text-description mt-1 text-[11px]">
                            From {message.from} at {message.timestamp}
                          </div>
                        </div>
                        <div className="text-description text-[11px]">
                          {getMessageStatusLabel(message)}
                        </div>
                      </div>

                      <div className="text-description mt-2 whitespace-pre-wrap break-words text-xs">
                        {message.text}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-description text-[11px]">
                          {statusDetail ?? "Unread mailbox item"}
                        </div>
                        {canDelegate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="my-0 px-2 py-1 text-[11px]"
                            data-testid={`team-coordination-delegate-${message.id}`}
                            disabled={
                              isRefreshing || Boolean(isDelegatingMessageId)
                            }
                            onClick={() => void handleDelegateMessage(message)}
                          >
                            <span className="flex items-center gap-1">
                              <PaperAirplaneIcon className="h-3.5 w-3.5" />
                              {isDelegating ? "Delegating..." : "Delegate"}
                            </span>
                          </Button>
                        ) : null}
                      </div>

                      {lastDelegatedResult?.messageId === message.id ? (
                        <div
                          className="text-description mt-2 whitespace-pre-wrap break-words text-[11px]"
                          data-testid={`team-coordination-delegate-result-${message.id}`}
                        >
                          {lastDelegatedResult.content}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {mailboxMetadata.truncated ? (
                  <div className="text-description text-[11px]">
                    Showing {mailboxMetadata.messages.length} of{" "}
                    {mailboxMetadata.totalMessages} message(s).
                  </div>
                ) : null}
              </div>
            ) : (
              <pre className="text-description mt-2 whitespace-pre-wrap break-words text-xs font-normal">
                {snapshot.mailbox?.content ??
                  `Mailbox for ${selectedMailboxOwner} is unavailable.`}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
