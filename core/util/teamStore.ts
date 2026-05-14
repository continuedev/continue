import {
  loadSessionScopedJsonState,
  saveSessionScopedJsonState,
} from "./sessionScopedStore";

export type TeamMemberStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TeamMember {
  name: string;
  description?: string;
  subagentName?: string;
  status: TeamMemberStatus;
  lastPrompt?: string;
  lastResult?: string;
  startedAt?: number;
  finishedAt?: number;
  lastRunAt?: number;
}

export interface TeamRecord {
  teamName: string;
  description?: string;
  leadName: string;
  leadSessionId: string;
  createdAt: number;
  members: TeamMember[];
}

interface TeamState {
  activeTeam: TeamRecord | null;
}

const TEAM_NAMESPACE = "teams";
export const TEAM_LEAD_NAME = "team-lead";

function createEmptyTeamState(): TeamState {
  return {
    activeTeam: null,
  };
}

function requireSessionId(sessionId: string): string {
  const normalized = sessionId.trim();
  if (!normalized) {
    throw new Error("A non-empty sessionId is required for team state.");
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

async function loadTeamState(sessionId: string): Promise<TeamState> {
  return loadSessionScopedJsonState(
    TEAM_NAMESPACE,
    requireSessionId(sessionId),
    createEmptyTeamState(),
  );
}

async function saveTeamState(
  sessionId: string,
  state: TeamState,
): Promise<void> {
  await saveSessionScopedJsonState(
    TEAM_NAMESPACE,
    requireSessionId(sessionId),
    state,
  );
}

function ensureTeamExists(
  activeTeam: TeamRecord | null,
  expectedName?: string,
): TeamRecord {
  if (!activeTeam) {
    throw new Error("No active team exists for this session.");
  }

  if (expectedName && activeTeam.teamName !== expectedName) {
    throw new Error(
      `Active team is "${activeTeam.teamName}", not "${expectedName}".`,
    );
  }

  return activeTeam;
}

function upsertMember(
  team: TeamRecord,
  memberName: string,
  updates: Partial<TeamMember>,
): TeamRecord {
  const normalizedName = normalizeName(memberName, "memberName");
  const existingIndex = team.members.findIndex(
    (member) => member.name === normalizedName,
  );

  if (existingIndex === -1) {
    return {
      ...team,
      members: [
        ...team.members,
        {
          name: normalizedName,
          status: "idle",
          ...updates,
        },
      ],
    };
  }

  const nextMembers = [...team.members];
  nextMembers[existingIndex] = {
    ...nextMembers[existingIndex],
    ...updates,
    name: normalizedName,
  };

  return {
    ...team,
    members: nextMembers,
  };
}

export async function getActiveTeam(
  sessionId: string,
): Promise<TeamRecord | null> {
  const state = await loadTeamState(sessionId);
  return state.activeTeam;
}

export async function createTeam(
  sessionId: string,
  input: {
    teamName: string;
    description?: string;
    leadName?: string;
  },
): Promise<TeamRecord> {
  const normalizedSessionId = requireSessionId(sessionId);
  const teamName = normalizeName(input.teamName, "teamName");
  const leadName = normalizeName(input.leadName ?? TEAM_LEAD_NAME, "leadName");
  const state = await loadTeamState(normalizedSessionId);

  if (state.activeTeam && state.activeTeam.teamName !== teamName) {
    throw new Error(
      `Team "${state.activeTeam.teamName}" is already active in this session. Delete it before creating another team.`,
    );
  }

  if (state.activeTeam && state.activeTeam.teamName === teamName) {
    return state.activeTeam;
  }

  const now = Date.now();
  const team: TeamRecord = {
    teamName,
    description: input.description?.trim() || undefined,
    leadName,
    leadSessionId: normalizedSessionId,
    createdAt: now,
    members: [
      {
        name: leadName,
        status: "idle",
        lastRunAt: now,
      },
    ],
  };

  await saveTeamState(normalizedSessionId, { activeTeam: team });
  return team;
}

export async function deleteTeam(
  sessionId: string,
  teamName?: string,
): Promise<TeamRecord | null> {
  const normalizedSessionId = requireSessionId(sessionId);
  const state = await loadTeamState(normalizedSessionId);
  if (!state.activeTeam) {
    return null;
  }

  if (
    teamName &&
    state.activeTeam.teamName !== normalizeName(teamName, "teamName")
  ) {
    return null;
  }

  const deleted = state.activeTeam;
  await saveTeamState(normalizedSessionId, { activeTeam: null });
  return deleted;
}

export async function upsertTeamMember(
  sessionId: string,
  teamName: string,
  memberName: string,
  updates: Partial<TeamMember>,
): Promise<TeamRecord> {
  const normalizedSessionId = requireSessionId(sessionId);
  const state = await loadTeamState(normalizedSessionId);
  const team = ensureTeamExists(
    state.activeTeam,
    normalizeName(teamName, "teamName"),
  );
  const updatedTeam = upsertMember(team, memberName, updates);
  await saveTeamState(normalizedSessionId, { activeTeam: updatedTeam });
  return updatedTeam;
}

export async function startTeamMemberRun(
  sessionId: string,
  input: {
    teamName: string;
    teammateName: string;
    subagentName?: string;
    description?: string;
    prompt: string;
  },
): Promise<TeamRecord> {
  const now = Date.now();
  return upsertTeamMember(sessionId, input.teamName, input.teammateName, {
    description: input.description?.trim() || undefined,
    subagentName: input.subagentName,
    status: "running",
    lastPrompt: input.prompt,
    lastRunAt: now,
    startedAt: now,
    finishedAt: undefined,
  });
}

export async function finishTeamMemberRun(
  sessionId: string,
  input: {
    teamName: string;
    teammateName: string;
    status: Extract<TeamMemberStatus, "completed" | "failed" | "cancelled">;
    result: string;
  },
): Promise<TeamRecord> {
  const now = Date.now();
  return upsertTeamMember(sessionId, input.teamName, input.teammateName, {
    status: input.status,
    lastResult: input.result,
    lastRunAt: now,
    finishedAt: now,
  });
}

export function formatTeam(
  team: TeamRecord,
  options?: {
    mailboxCounts?: Record<string, number>;
  },
): string {
  const lines = [`Team ${team.teamName}`];
  if (team.description) {
    lines.push(team.description);
  }
  lines.push(`Lead: ${team.leadName}`);

  if (team.members.length === 0) {
    lines.push("No teammates registered yet.");
    return lines.join("\n");
  }

  lines.push("Members:");
  for (const member of team.members) {
    const role = member.subagentName ? ` (${member.subagentName})` : "";
    const unreadCount = options?.mailboxCounts?.[member.name] ?? 0;
    const suffix = unreadCount > 0 ? `, unread=${unreadCount}` : "";
    lines.push(`- ${member.name}${role}: ${member.status}${suffix}`);
  }

  return lines.join("\n");
}
