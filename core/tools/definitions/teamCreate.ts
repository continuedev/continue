import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const teamCreateTool: Tool = {
  type: "function",
  displayTitle: "Team Create",
  wouldLikeTo: "create a session team",
  isCurrently: "creating a session team",
  hasAlready: "created a session team",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TeamCreate,
    description:
      "Create an active lightweight team for the current chat session. This is the foundation for mailbox-based multi-agent coordination in core.",
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
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
