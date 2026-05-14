import { getSwarmIdentity } from "../swarm/identity.js";
import { readUnreadMailboxMessages } from "../swarm/mailbox.js";
import { readSwarmTeam, TEAM_LEAD_NAME } from "../swarm/teamRuntime.js";
import { getActiveTeam } from "../util/teamStore.js";

import { Tool } from "./types.js";

async function resolveTeamName(explicit?: string): Promise<string> {
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const identity = getSwarmIdentity();
  if (identity?.teamName) {
    return identity.teamName;
  }

  const activeTeam = await getActiveTeam();
  if (activeTeam?.teamName) {
    return activeTeam.teamName;
  }

  throw new Error("No active team context is available.");
}

export const teamStatusTool: Tool = {
  name: "TeamStatus",
  displayName: "TeamStatus",
  description:
    "Show current swarm team members, backend state, and unread mailbox items for the lead or current teammate.",
  readonly: true,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {
      team_name: {
        type: "string",
        description:
          "Optional team name when not using the current active team.",
      },
      include_mailbox: {
        type: "boolean",
        description: "Whether to include unread mailbox summaries.",
      },
    },
  },
  run: async (args: {
    team_name?: string;
    include_mailbox?: boolean;
  }): Promise<string> => {
    const teamName = await resolveTeamName(args.team_name);
    const team = await readSwarmTeam(teamName);
    if (!team) {
      throw new Error(`Team \"${teamName}\" does not exist.`);
    }

    const lines = [`Team ${team.name}`];
    if (team.description) {
      lines.push(team.description);
    }

    lines.push(`Lead: ${team.leadAgentId}`);
    lines.push("Members:");
    for (const member of team.members) {
      const extras = [
        member.backendType,
        member.status,
        member.isActive === false ? "inactive" : "active",
        member.jobId ? `job=${member.jobId}` : undefined,
        member.tmuxPaneId && member.backendType === "tmux"
          ? `pane=${member.tmuxPaneId}`
          : undefined,
      ].filter(Boolean);
      lines.push(`- ${member.name}: ${extras.join(", ")}`);
      if (member.lastResult) {
        lines.push(`  last_result: ${member.lastResult}`);
      }
    }

    if (args.include_mailbox) {
      const mailboxOwner = getSwarmIdentity()?.agentName ?? TEAM_LEAD_NAME;
      const unread = await readUnreadMailboxMessages(teamName, mailboxOwner);
      lines.push(`Unread mailbox for ${mailboxOwner}: ${unread.length}`);
      for (const message of unread.slice(0, 10)) {
        const preview =
          message.summary ||
          message.text.replace(/\s+/g, " ").slice(0, 80).trim();
        lines.push(`- ${message.from}: ${preview}`);
      }
    }

    return lines.join("\n");
  },
};
