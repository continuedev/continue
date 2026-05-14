import { getCurrentSession } from "../session.js";

import {
  loadSessionScopedJsonState,
  saveSessionScopedJsonState,
} from "./sessionScopedStore.js";

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
  leadSessionId: string;
  createdAt: number;
  members: TeamMember[];
}

interface TeamState {
  activeTeam: TeamRecord | null;
}

const TEAM_NAMESPACE = "teams";

const EMPTY_TEAM_STATE: TeamState = {
  activeTeam: null,
};

async function loadTeamState(): Promise<TeamState> {
  return loadSessionScopedJsonState(TEAM_NAMESPACE, EMPTY_TEAM_STATE);
}

async function saveTeamState(state: TeamState): Promise<void> {
  await saveSessionScopedJsonState(TEAM_NAMESPACE, state);
}

function normalizeName(value: string): string {
  return value.trim();
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
      `Active team is \"${activeTeam.teamName}\", not \"${expectedName}\".`,
    );
  }

  return activeTeam;
}

function upsertMember(
  team: TeamRecord,
  memberName: string,
  updates: Partial<TeamMember>,
): TeamRecord {
  const normalizedName = normalizeName(memberName);
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

  const existing = team.members[existingIndex];
  const nextMembers = [...team.members];
  nextMembers[existingIndex] = {
    ...existing,
    ...updates,
    name: normalizedName,
  };

  return {
    ...team,
    members: nextMembers,
  };
}

export async function getActiveTeam(): Promise<TeamRecord | null> {
  const state = await loadTeamState();
  return state.activeTeam;
}

export async function createTeam(input: {
  teamName: string;
  description?: string;
}): Promise<TeamRecord> {
  const teamName = normalizeName(input.teamName);
  if (!teamName) {
    throw new Error("teamName is required");
  }

  const state = await loadTeamState();
  if (state.activeTeam && state.activeTeam.teamName !== teamName) {
    throw new Error(
      `Team \"${state.activeTeam.teamName}\" is already active in this session. Delete it before creating another team.`,
    );
  }

  if (state.activeTeam && state.activeTeam.teamName === teamName) {
    return state.activeTeam;
  }

  const team: TeamRecord = {
    teamName,
    description: input.description?.trim() || undefined,
    leadSessionId: getCurrentSession().sessionId,
    createdAt: Date.now(),
    members: [],
  };

  await saveTeamState({ activeTeam: team });
  return team;
}

export async function deleteTeam(
  teamName?: string,
): Promise<TeamRecord | null> {
  const state = await loadTeamState();
  if (!state.activeTeam) {
    return null;
  }

  if (teamName && state.activeTeam.teamName !== normalizeName(teamName)) {
    return null;
  }

  const deleted = state.activeTeam;
  await saveTeamState({ activeTeam: null });
  return deleted;
}

export async function startTeamMemberRun(input: {
  teamName: string;
  teammateName: string;
  subagentName?: string;
  description?: string;
  prompt: string;
}): Promise<TeamRecord> {
  const state = await loadTeamState();
  const team = ensureTeamExists(
    state.activeTeam,
    normalizeName(input.teamName),
  );
  const now = Date.now();
  const updatedTeam = upsertMember(team, input.teammateName, {
    description: input.description?.trim() || undefined,
    subagentName: input.subagentName,
    status: "running",
    lastPrompt: input.prompt,
    lastRunAt: now,
    startedAt: now,
    finishedAt: undefined,
  });
  await saveTeamState({ activeTeam: updatedTeam });
  return updatedTeam;
}

export async function finishTeamMemberRun(input: {
  teamName: string;
  teammateName: string;
  status: Extract<TeamMemberStatus, "completed" | "failed" | "cancelled">;
  result: string;
}): Promise<TeamRecord> {
  const state = await loadTeamState();
  const team = ensureTeamExists(
    state.activeTeam,
    normalizeName(input.teamName),
  );
  const now = Date.now();
  const updatedTeam = upsertMember(team, input.teammateName, {
    status: input.status,
    lastResult: input.result,
    lastRunAt: now,
    finishedAt: now,
  });
  await saveTeamState({ activeTeam: updatedTeam });
  return updatedTeam;
}

export function formatTeam(team: TeamRecord): string {
  const lines = [`Team ${team.teamName}`];
  if (team.description) {
    lines.push(team.description);
  }

  if (team.members.length === 0) {
    lines.push("No teammates registered yet.");
    return lines.join("\n");
  }

  lines.push("Members:");
  for (const member of team.members) {
    const role = member.subagentName ? ` (${member.subagentName})` : "";
    lines.push(`- ${member.name}${role}: ${member.status}`);
  }

  return lines.join("\n");
}
