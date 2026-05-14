import { createSwarmTeam } from "../swarm/teamRuntime.js";
import { createTeam, formatTeam } from "../util/teamStore.js";

import { Tool } from "./types.js";

export const teamCreateTool: Tool = {
  name: "TeamCreate",
  displayName: "TeamCreate",
  description:
    "Create an active lightweight subagent team for the current CLI session.",
  readonly: false,
  isBuiltIn: true,
  parameters: {
    type: "object",
    required: ["team_name"],
    properties: {
      team_name: {
        type: "string",
        description: "Name for the team to create.",
      },
      description: {
        type: "string",
        description: "Optional team purpose or working agreement.",
      },
    },
  },
  preprocess: async (args: { team_name: string; description?: string }) => ({
    args,
    preview: [
      {
        type: "text",
        content: `Create team ${args.team_name}`,
      },
    ],
  }),
  run: async (args: {
    team_name: string;
    description?: string;
  }): Promise<string> => {
    const [team] = await Promise.all([
      createTeam({
        teamName: args.team_name,
        description: args.description,
      }),
      createSwarmTeam({
        teamName: args.team_name,
        description: args.description,
      }),
    ]);

    return [
      formatTeam(team),
      "",
      "Use Subagent with teammate_name to delegate work. Set backend=process or backend=tmux for persistent swarm workers.",
      "Use TeamStatus to inspect workers and SendMessage for explicit mailbox delivery.",
    ].join("\n");
  },
};
