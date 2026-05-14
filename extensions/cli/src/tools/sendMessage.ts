import { appendMailboxMessage } from "../swarm/mailbox.js";
import { getSwarmIdentity } from "../swarm/identity.js";
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

export const sendMessageTool: Tool = {
  name: "SendMessage",
  displayName: "SendMessage",
  description:
    "Send a mailbox message to one teammate, the team lead, or all teammates in the active swarm.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["to", "message"],
    properties: {
      to: {
        type: "string",
        description:
          "Recipient teammate name, `team-lead`, or `*` to broadcast to all teammates except the sender.",
      },
      message: {
        type: "string",
        description: "Message content to deliver via the swarm mailbox.",
      },
      summary: {
        type: "string",
        description: "Optional short preview shown by TeamStatus.",
      },
      team_name: {
        type: "string",
        description:
          "Optional team name when not using the current active team.",
      },
      kind: {
        type: "string",
        enum: ["message", "prompt", "control"],
        description: "Mailbox message kind. Defaults to `message`.",
      },
    },
  },
  run: async (args: {
    to: string;
    message: string;
    summary?: string;
    team_name?: string;
    kind?: "message" | "prompt" | "control";
  }): Promise<string> => {
    const teamName = await resolveTeamName(args.team_name);
    const team = await readSwarmTeam(teamName);
    if (!team) {
      throw new Error(`Team \"${teamName}\" does not exist.`);
    }

    const sender = getSwarmIdentity()?.agentName ?? TEAM_LEAD_NAME;
    const recipients =
      args.to === "*"
        ? team.members
            .map((member) => member.name)
            .filter((name) => name !== sender)
        : [args.to.trim()];

    if (recipients.length === 0) {
      return "No recipients matched the broadcast target.";
    }

    for (const recipient of recipients) {
      await appendMailboxMessage({
        teamName,
        teammateName: recipient,
        message: {
          from: sender,
          text: args.message,
          timestamp: new Date().toISOString(),
          summary: args.summary,
          kind: args.kind ?? "message",
          metadata: {
            source: "SendMessage",
          },
        },
      });
    }

    return args.to === "*"
      ? `Broadcast message sent to ${recipients.length} teammate(s) in ${teamName}.`
      : `Message sent to ${recipients[0]} in ${teamName}.`;
  },
};
