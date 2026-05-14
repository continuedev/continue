import type { ContextItem } from "../..";

import { getToolSessionId } from "../../util/sessionScopedStore";
import {
  appendMailboxMessage,
  deleteTeamMailbox,
  getUnreadMailboxCounts,
  readMailbox,
  readUnreadMailboxMessages,
  takeUnreadMailboxMessages,
  type TeamMailboxMessage,
  type TeamMailboxMessageKind,
} from "../../util/teamMailboxStore";
import {
  createTeam,
  deleteTeam,
  formatTeam,
  getActiveTeam,
  TEAM_LEAD_NAME,
  upsertTeamMember,
} from "../../util/teamStore";

import { ToolImpl } from ".";

const TEAM_MAILBOX_KINDS = new Set<TeamMailboxMessageKind>([
  "message",
  "prompt",
  "control",
]);

function requireText(value: unknown, fieldName: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function optionalText(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

function requireTeamSessionId(extras: { sessionId?: string }): string {
  const sessionId = getToolSessionId(extras);
  if (!sessionId) {
    throw new Error("Team tools require an active session.");
  }
  return sessionId;
}

function buildContextItem(
  name: string,
  description: string,
  content: string,
  metadata?: Record<string, unknown>,
): ContextItem {
  return {
    name,
    description,
    content,
    metadata,
  };
}

async function requireActiveTeam(sessionId: string, explicitName?: string) {
  const team = await getActiveTeam(sessionId);
  if (!team) {
    throw new Error("No active team exists for this session.");
  }

  if (explicitName && team.teamName !== explicitName) {
    throw new Error(
      `Active team is "${team.teamName}", not "${explicitName}".`,
    );
  }

  return team;
}

function formatMailboxPreview(message: TeamMailboxMessage): string {
  const preview =
    message.summary || message.text.replace(/\s+/g, " ").slice(0, 80).trim();
  return `- ${message.from} [${message.kind}]: ${preview}`;
}

function normalizeMaxMessages(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 10;
  }
  return Math.floor(value);
}

function normalizeMessageIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const ids = value
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
}

function filterMailboxMessages(
  messages: TeamMailboxMessage[],
  options?: {
    ids?: string[];
  },
): TeamMailboxMessage[] {
  if (!options?.ids || options.ids.length === 0) {
    return messages;
  }

  const ids = new Set(options.ids);
  return messages.filter((message) => ids.has(message.id));
}

function buildTeamMailboxMetadata(args: {
  teamName: string;
  mailboxOwner: string;
  messages: TeamMailboxMessage[];
  visibleMessages: TeamMailboxMessage[];
}): Record<string, unknown> {
  return {
    teamName: args.teamName,
    mailboxOwner: args.mailboxOwner,
    totalMessages: args.messages.length,
    unreadCount: args.messages.filter((message) => !message.read).length,
    truncated: args.messages.length > args.visibleMessages.length,
    messages: args.visibleMessages.map((message) => ({
      id: message.id,
      from: message.from,
      text: message.text,
      timestamp: message.timestamp,
      summary: message.summary,
      kind: message.kind,
      read: message.read,
      readAt: message.readAt,
      readSource: message.readSource,
      readBy: message.readBy,
      metadata: message.metadata,
    })),
  };
}

export const teamCreateImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTeamSessionId(extras);
  const team = await createTeam(sessionId, {
    teamName: requireText(args?.team_name, "team_name"),
    description: optionalText(args?.description),
  });

  return [
    buildContextItem(
      "Team Created",
      `Team ${team.teamName}`,
      [
        formatTeam(team),
        "",
        "Use send_message to deliver work or notes to teammates through the session mailbox.",
        "Use team_status or team_mailbox to inspect unread mailbox activity.",
      ].join("\n"),
    ),
  ];
};

export const teamDeleteImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTeamSessionId(extras);
  const teamName = optionalText(args?.team_name);
  const team = await deleteTeam(sessionId, teamName);

  if (!team) {
    return [
      buildContextItem(
        "Team Deleted",
        "No team deleted",
        teamName
          ? `No active team named ${teamName}.`
          : "No active team to delete.",
      ),
    ];
  }

  await deleteTeamMailbox(sessionId, team.teamName);
  return [
    buildContextItem(
      "Team Deleted",
      `Team ${team.teamName}`,
      `Deleted team:\n${formatTeam(team)}`,
    ),
  ];
};

export const teamStatusImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTeamSessionId(extras);
  const team = await requireActiveTeam(
    sessionId,
    optionalText(args?.team_name),
  );
  const mailboxCounts = await getUnreadMailboxCounts(sessionId, team.teamName);
  const lines = [formatTeam(team, { mailboxCounts })];

  if (args?.include_mailbox) {
    const mailboxOwner = optionalText(args?.member_name) ?? TEAM_LEAD_NAME;
    const unread = await readUnreadMailboxMessages(
      sessionId,
      team.teamName,
      mailboxOwner,
    );
    lines.push("", `Unread mailbox for ${mailboxOwner}: ${unread.length}`);
    for (const message of unread.slice(0, 10)) {
      lines.push(formatMailboxPreview(message));
    }
  }

  return [
    buildContextItem("Team Status", `Team ${team.teamName}`, lines.join("\n")),
  ];
};

export const teamMailboxImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTeamSessionId(extras);
  const team = await requireActiveTeam(
    sessionId,
    optionalText(args?.team_name),
  );
  const mailboxOwner = optionalText(args?.member_name) ?? TEAM_LEAD_NAME;
  const unreadOnly = args?.unread_only === true;
  const markRead = args?.mark_read === true;
  const maxMessages = normalizeMaxMessages(args?.max_messages);
  const messageIds = normalizeMessageIds(args?.message_ids);

  const messages = markRead
    ? await takeUnreadMailboxMessages(sessionId, team.teamName, mailboxOwner, {
        ids: messageIds,
        readSource: optionalText(args?.read_source) ?? "team_mailbox",
        readBy: optionalText(args?.read_by) ?? mailboxOwner,
      })
    : unreadOnly
      ? await readUnreadMailboxMessages(
          sessionId,
          team.teamName,
          mailboxOwner,
          {
            ids: messageIds,
          },
        )
      : filterMailboxMessages(
          await readMailbox(sessionId, team.teamName, mailboxOwner),
          { ids: messageIds },
        );

  if (messages.length === 0) {
    return [
      buildContextItem(
        "Team Mailbox",
        `Mailbox ${mailboxOwner}`,
        `Mailbox for ${mailboxOwner} in ${team.teamName} is empty.`,
        buildTeamMailboxMetadata({
          teamName: team.teamName,
          mailboxOwner,
          messages: [],
          visibleMessages: [],
        }),
      ),
    ];
  }

  const visibleMessages = messages.slice(0, maxMessages);
  const lines = [
    `Mailbox for ${mailboxOwner} in ${team.teamName} (${messages.length} message(s)):`,
  ];

  for (const message of visibleMessages) {
    lines.push(
      `- [${message.kind}] ${message.from} @ ${message.timestamp}${
        message.summary ? ` -- ${message.summary}` : ""
      }`,
    );
    lines.push(message.text);
  }

  if (messages.length > visibleMessages.length) {
    lines.push(
      `Showing ${visibleMessages.length} of ${messages.length} message(s).`,
    );
  }

  return [
    buildContextItem(
      "Team Mailbox",
      `Mailbox ${mailboxOwner}`,
      lines.join("\n"),
      buildTeamMailboxMetadata({
        teamName: team.teamName,
        mailboxOwner,
        messages,
        visibleMessages,
      }),
    ),
  ];
};

export const sendMessageImpl: ToolImpl = async (args, extras) => {
  const sessionId = requireTeamSessionId(extras);
  const team = await requireActiveTeam(
    sessionId,
    optionalText(args?.team_name),
  );
  const sender = optionalText(args?.from) ?? TEAM_LEAD_NAME;
  const rawKind = optionalText(args?.kind);
  const kind = (rawKind ?? "message") as TeamMailboxMessageKind;

  if (!TEAM_MAILBOX_KINDS.has(kind)) {
    throw new Error(`Invalid mailbox message kind: ${rawKind}`);
  }

  const teamWithSender = await upsertTeamMember(
    sessionId,
    team.teamName,
    sender,
    {},
  );
  const target = requireText(args?.to, "to");
  const recipients =
    target === "*"
      ? teamWithSender.members
          .map((member) => member.name)
          .filter((name) => name !== sender)
      : [target];

  if (recipients.length === 0) {
    return [
      buildContextItem(
        "Mailbox Message",
        `Team ${team.teamName}`,
        "No recipients matched the broadcast target.",
      ),
    ];
  }

  const timestamp = new Date().toISOString();
  for (const recipient of recipients) {
    await upsertTeamMember(sessionId, team.teamName, recipient, {});
    await appendMailboxMessage(sessionId, {
      teamName: team.teamName,
      memberName: recipient,
      message: {
        from: sender,
        text: requireText(args?.message, "message"),
        timestamp,
        summary: optionalText(args?.summary),
        kind,
        metadata: {
          source: "send_message",
        },
      },
    });
  }

  return [
    buildContextItem(
      "Mailbox Message",
      `Team ${team.teamName}`,
      target === "*"
        ? `Broadcast message sent to ${recipients.length} teammate(s) in ${team.teamName}.`
        : `Message sent to ${recipients[0]} in ${team.teamName}.`,
    ),
  ];
};
