import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const teamStatusTool: Tool = {
  type: "function",
  displayTitle: "Team Status",
  wouldLikeTo: "inspect team and mailbox status",
  isCurrently: "inspecting team and mailbox status",
  hasAlready: "inspected team and mailbox status",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TeamStatus,
    description:
      "Show current team members and unread mailbox state for the active session team.",
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
          description:
            "Whether to include unread mailbox previews for a specific member.",
        },
        member_name: {
          type: "string",
          description:
            "Optional mailbox owner to preview when include_mailbox is true. Defaults to team-lead.",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
