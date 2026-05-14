import { cleanupSwarmTeammates } from "../swarm/spawn.js";
import { deleteSwarmTeam } from "../swarm/teamRuntime.js";
import { deleteTeam, formatTeam } from "../util/teamStore.js";

import { Tool } from "./types.js";

export const teamDeleteTool: Tool = {
  name: "TeamDelete",
  displayName: "TeamDelete",
  description:
    "Delete the active lightweight subagent team for the current CLI session.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    properties: {
      team_name: {
        type: "string",
        description:
          "Optional team name to confirm which active team to delete.",
      },
    },
  },
  run: async (args: { team_name?: string }): Promise<string> => {
    const team = await deleteTeam(args.team_name);
    if (!team) {
      return args.team_name
        ? `No active team named ${args.team_name}.`
        : "No active team to delete.";
    }

    const terminatedWorkers = await cleanupSwarmTeammates(team.teamName);
    await deleteSwarmTeam(team.teamName);

    return `Deleted team:\n${formatTeam(team)}\n\nTerminated workers: ${terminatedWorkers}`;
  },
};
