import fs from "fs/promises";
import path from "path";

import { env } from "../env.js";
import { getCurrentSession } from "../session.js";

import { withFileLock } from "./fileLock.js";

export type SwarmBackend = "leader" | "in-process" | "process" | "tmux";

export interface SwarmTeamMember {
  agentId: string;
  name: string;
  agentType?: string;
  model?: string;
  prompt?: string;
  color?: string;
  planModeRequired?: boolean;
  joinedAt: number;
  tmuxPaneId: string;
  cwd: string;
  sessionId?: string;
  subscriptions: string[];
  backendType: SwarmBackend;
  jobId?: string;
  isActive?: boolean;
  status?: "idle" | "running" | "completed" | "failed" | "cancelled";
  lastPrompt?: string;
  lastResult?: string;
  lastRunAt?: number;
  finishedAt?: number;
}

export interface SwarmTeamRecord {
  name: string;
  description?: string;
  createdAt: number;
  leadAgentId: string;
  leadSessionId?: string;
  members: SwarmTeamMember[];
}

export const TEAM_LEAD_NAME = "team-lead";

function getSwarmRootDir(): string {
  return path.join(env.continueHome, "swarms");
}

export function sanitizeName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function sanitizeAgentName(value: string): string {
  return value.trim().replace(/@/g, "-");
}

export function formatSwarmAgentId(
  agentName: string,
  teamName: string,
): string {
  return `${sanitizeAgentName(agentName)}@${sanitizeName(teamName)}`;
}

export function getTeamDir(teamName: string): string {
  return path.join(getSwarmRootDir(), sanitizeName(teamName));
}

export function getTeamFilePath(teamName: string): string {
  return path.join(getTeamDir(teamName), "team.json");
}

function getTeamLockPath(teamName: string): string {
  return `${getTeamFilePath(teamName)}.lock`;
}

async function ensureTeamDir(teamName: string): Promise<void> {
  await fs.mkdir(getTeamDir(teamName), { recursive: true });
}

export async function readSwarmTeam(
  teamName: string,
): Promise<SwarmTeamRecord | null> {
  try {
    const content = await fs.readFile(getTeamFilePath(teamName), "utf8");
    return JSON.parse(content) as SwarmTeamRecord;
  } catch {
    return null;
  }
}

export async function writeSwarmTeam(team: SwarmTeamRecord): Promise<void> {
  await ensureTeamDir(team.name);
  await fs.writeFile(
    getTeamFilePath(team.name),
    `${JSON.stringify(team, null, 2)}\n`,
    "utf8",
  );
}

export async function createSwarmTeam(input: {
  teamName: string;
  description?: string;
  leadAgentName?: string;
}): Promise<SwarmTeamRecord> {
  const teamName = input.teamName.trim();
  if (!teamName) {
    throw new Error("teamName is required");
  }

  const leadAgentName = input.leadAgentName?.trim() || TEAM_LEAD_NAME;

  return withFileLock(getTeamLockPath(teamName), async () => {
    const existing = await readSwarmTeam(teamName);
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const leadAgentId = formatSwarmAgentId(leadAgentName, teamName);
    const team: SwarmTeamRecord = {
      name: teamName,
      description: input.description?.trim() || undefined,
      createdAt: now,
      leadAgentId,
      leadSessionId: getCurrentSession().sessionId,
      members: [
        {
          agentId: leadAgentId,
          name: leadAgentName,
          joinedAt: now,
          tmuxPaneId: "leader",
          cwd: process.cwd(),
          sessionId: getCurrentSession().sessionId,
          subscriptions: [],
          backendType: "leader",
          isActive: true,
        },
      ],
    };

    await writeSwarmTeam(team);
    return team;
  });
}

export async function deleteSwarmTeam(teamName: string): Promise<boolean> {
  const target = getTeamDir(teamName);
  try {
    await fs.rm(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function reserveSwarmTeammateName(
  baseName: string,
  teamName: string,
): Promise<string> {
  const trimmedBaseName = baseName.trim();
  if (!trimmedBaseName) {
    throw new Error("baseName is required");
  }

  const team = await readSwarmTeam(teamName);
  if (!team) {
    return trimmedBaseName;
  }

  const existing = new Set(
    team.members.map((member) => member.name.toLowerCase()),
  );
  if (!existing.has(trimmedBaseName.toLowerCase())) {
    return trimmedBaseName;
  }

  let suffix = 2;
  while (existing.has(`${trimmedBaseName}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${trimmedBaseName}-${suffix}`;
}

export async function upsertSwarmTeamMember(input: {
  teamName: string;
  member: SwarmTeamMember;
}): Promise<SwarmTeamRecord> {
  return withFileLock(getTeamLockPath(input.teamName), async () => {
    const team = await readSwarmTeam(input.teamName);
    if (!team) {
      throw new Error(`Team \"${input.teamName}\" does not exist.`);
    }

    const nextMembers = [...team.members];
    const existingIndex = nextMembers.findIndex(
      (member) =>
        member.agentId === input.member.agentId ||
        member.name === input.member.name,
    );

    if (existingIndex >= 0) {
      nextMembers[existingIndex] = {
        ...nextMembers[existingIndex],
        ...input.member,
      };
    } else {
      nextMembers.push(input.member);
    }

    const nextTeam: SwarmTeamRecord = {
      ...team,
      members: nextMembers,
    };
    await writeSwarmTeam(nextTeam);
    return nextTeam;
  });
}

export async function removeSwarmTeamMember(input: {
  teamName: string;
  agentId?: string;
  name?: string;
}): Promise<SwarmTeamRecord | null> {
  return withFileLock(getTeamLockPath(input.teamName), async () => {
    const team = await readSwarmTeam(input.teamName);
    if (!team) {
      return null;
    }

    const nextMembers = team.members.filter((member) => {
      if (input.agentId && member.agentId === input.agentId) {
        return false;
      }

      if (input.name && member.name === input.name) {
        return false;
      }

      return true;
    });

    const nextTeam: SwarmTeamRecord = {
      ...team,
      members: nextMembers,
    };
    await writeSwarmTeam(nextTeam);
    return nextTeam;
  });
}
