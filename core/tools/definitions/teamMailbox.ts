import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const teamMailboxTool: Tool = {
  type: "function",
  displayTitle: "Team Mailbox",
  wouldLikeTo: "read a teammate mailbox",
  isCurrently: "reading a teammate mailbox",
  hasAlready: "read a teammate mailbox",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TeamMailbox,
    description:
      "Read mailbox messages for a member of the active session team, optionally marking unread messages as read.",
    parameters: {
      type: "object",
      properties: {
        team_name: {
          type: "string",
          description:
            "Optional team name when not using the current active team.",
        },
        member_name: {
          type: "string",
          description: "Mailbox owner to inspect. Defaults to team-lead.",
        },
        unread_only: {
          type: "boolean",
          description: "Whether to return only unread messages.",
        },
        mark_read: {
          type: "boolean",
          description:
            "Whether to mark unread messages as read while fetching them.",
        },
        message_ids: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "Optional specific mailbox message ids to fetch or mark read.",
        },
        read_source: {
          type: "string",
          description:
            "Optional provenance label to store when mark_read is true.",
        },
        read_by: {
          type: "string",
          description: "Optional actor label to store when mark_read is true.",
        },
        max_messages: {
          type: "number",
          description: "Maximum number of messages to return. Defaults to 10.",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
