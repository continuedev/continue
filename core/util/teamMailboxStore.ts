import { randomUUID } from "node:crypto";

import {
  deleteSessionScopedJsonState,
  loadSessionScopedJsonState,
  saveSessionScopedJsonState,
} from "./sessionScopedStore";

export type TeamMailboxMessageKind = "prompt" | "message" | "control";

interface MailboxMessageFilter {
  kinds?: TeamMailboxMessageKind[];
  ids?: string[];
}

interface MailboxReadProvenance {
  readAt?: string;
  readSource?: string;
  readBy?: string;
}

interface TakeMailboxMessagesOptions
  extends MailboxMessageFilter,
    MailboxReadProvenance {}

export interface TeamMailboxMessage {
  id: string;
  from: string;
  text: string;
  timestamp: string;
  summary?: string;
  read: boolean;
  kind: TeamMailboxMessageKind;
  metadata?: Record<string, unknown>;
  readAt?: string;
  readSource?: string;
  readBy?: string;
}

interface TeamMailboxState {
  teams: Record<string, Record<string, TeamMailboxMessage[]>>;
}

const TEAM_MAILBOX_NAMESPACE = "team-mailboxes";

function createEmptyMailboxState(): TeamMailboxState {
  return {
    teams: {},
  };
}

function requireSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized) {
    throw new Error(
      "A non-empty sessionId is required for team mailbox state.",
    );
  }
  return normalized;
}

function normalizeName(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

async function loadMailboxState(sessionId: string): Promise<TeamMailboxState> {
  return loadSessionScopedJsonState(
    TEAM_MAILBOX_NAMESPACE,
    requireSessionId(sessionId),
    createEmptyMailboxState(),
  );
}

async function saveMailboxState(
  sessionId: string,
  state: TeamMailboxState,
): Promise<void> {
  await saveSessionScopedJsonState(
    TEAM_MAILBOX_NAMESPACE,
    requireSessionId(sessionId),
    state,
  );
}

function getMailboxMessages(
  state: TeamMailboxState,
  teamName: string,
  memberName: string,
): TeamMailboxMessage[] {
  return state.teams[teamName]?.[memberName] ?? [];
}

function getMailboxFilters(options?: MailboxMessageFilter): {
  kinds?: Set<TeamMailboxMessageKind>;
  ids?: Set<string>;
} {
  return {
    kinds:
      options?.kinds && options.kinds.length > 0
        ? new Set(options.kinds)
        : undefined,
    ids:
      options?.ids && options.ids.length > 0 ? new Set(options.ids) : undefined,
  };
}

function matchesMailboxFilters(
  message: TeamMailboxMessage,
  options?: MailboxMessageFilter,
): boolean {
  const { kinds, ids } = getMailboxFilters(options);
  return (!kinds || kinds.has(message.kind)) && (!ids || ids.has(message.id));
}

export async function readMailbox(
  sessionId: string,
  teamName: string,
  memberName: string,
): Promise<TeamMailboxMessage[]> {
  const normalizedSessionId = requireSessionId(sessionId);
  const normalizedTeamName = normalizeName(teamName, "teamName");
  const normalizedMemberName = normalizeName(memberName, "memberName");
  const state = await loadMailboxState(normalizedSessionId);
  return getMailboxMessages(state, normalizedTeamName, normalizedMemberName);
}

export async function appendMailboxMessage(
  sessionId: string,
  input: {
    teamName: string;
    memberName: string;
    message: Omit<TeamMailboxMessage, "id" | "read"> & { id?: string };
  },
): Promise<TeamMailboxMessage> {
  const normalizedSessionId = requireSessionId(sessionId);
  const teamName = normalizeName(input.teamName, "teamName");
  const memberName = normalizeName(input.memberName, "memberName");
  const state = await loadMailboxState(normalizedSessionId);
  const currentMessages = getMailboxMessages(state, teamName, memberName);
  const nextMessage: TeamMailboxMessage = {
    id: input.message.id ?? randomUUID(),
    from: input.message.from,
    text: input.message.text,
    timestamp: input.message.timestamp,
    summary: input.message.summary,
    kind: input.message.kind,
    metadata: input.message.metadata,
    read: false,
  };

  await saveMailboxState(normalizedSessionId, {
    teams: {
      ...state.teams,
      [teamName]: {
        ...(state.teams[teamName] ?? {}),
        [memberName]: [...currentMessages, nextMessage],
      },
    },
  });

  return nextMessage;
}

export async function readUnreadMailboxMessages(
  sessionId: string,
  teamName: string,
  memberName: string,
  options?: MailboxMessageFilter,
): Promise<TeamMailboxMessage[]> {
  const messages = await readMailbox(sessionId, teamName, memberName);
  return messages.filter(
    (message) => !message.read && matchesMailboxFilters(message, options),
  );
}

export async function takeUnreadMailboxMessages(
  sessionId: string,
  teamName: string,
  memberName: string,
  options?: TakeMailboxMessagesOptions,
): Promise<TeamMailboxMessage[]> {
  const normalizedSessionId = requireSessionId(sessionId);
  const normalizedTeamName = normalizeName(teamName, "teamName");
  const normalizedMemberName = normalizeName(memberName, "memberName");
  const state = await loadMailboxState(normalizedSessionId);
  const currentMessages = getMailboxMessages(
    state,
    normalizedTeamName,
    normalizedMemberName,
  );
  const unread = currentMessages.filter(
    (message) => !message.read && matchesMailboxFilters(message, options),
  );

  if (unread.length === 0) {
    return [];
  }

  const unreadIds = new Set(unread.map((message) => message.id));
  const readAt = options?.readAt ?? new Date().toISOString();
  const nextMessages = currentMessages.map((message) =>
    unreadIds.has(message.id)
      ? {
          ...message,
          read: true,
          readAt,
          readSource: options?.readSource,
          readBy: options?.readBy,
        }
      : message,
  );

  await saveMailboxState(normalizedSessionId, {
    teams: {
      ...state.teams,
      [normalizedTeamName]: {
        ...(state.teams[normalizedTeamName] ?? {}),
        [normalizedMemberName]: nextMessages,
      },
    },
  });

  return nextMessages.filter((message) => unreadIds.has(message.id));
}

export async function getUnreadMailboxCounts(
  sessionId: string,
  teamName: string,
): Promise<Record<string, number>> {
  const normalizedSessionId = requireSessionId(sessionId);
  const normalizedTeamName = normalizeName(teamName, "teamName");
  const state = await loadMailboxState(normalizedSessionId);
  const teamMailboxes = state.teams[normalizedTeamName] ?? {};

  return Object.fromEntries(
    Object.entries(teamMailboxes).map(([memberName, messages]) => [
      memberName,
      messages.filter((message) => !message.read).length,
    ]),
  );
}

export async function deleteTeamMailbox(
  sessionId: string,
  teamName: string,
): Promise<void> {
  const normalizedSessionId = requireSessionId(sessionId);
  const normalizedTeamName = normalizeName(teamName, "teamName");
  const state = await loadMailboxState(normalizedSessionId);

  if (!(normalizedTeamName in state.teams)) {
    return;
  }

  const nextTeams = { ...state.teams };
  delete nextTeams[normalizedTeamName];

  if (Object.keys(nextTeams).length === 0) {
    await deleteSessionScopedJsonState(
      TEAM_MAILBOX_NAMESPACE,
      normalizedSessionId,
    );
    return;
  }

  await saveMailboxState(normalizedSessionId, { teams: nextTeams });
}
