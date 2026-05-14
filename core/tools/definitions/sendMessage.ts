import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const sendMessageTool: Tool = {
  type: "function",
  displayTitle: "Send Message",
  wouldLikeTo: "send a mailbox message",
  isCurrently: "sending a mailbox message",
  hasAlready: "sent a mailbox message",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.SendMessage,
    description:
      "Send a mailbox message to one teammate, the team lead, or all teammates in the active session team.",
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
          description: "Message content to deliver via the session mailbox.",
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
        from: {
          type: "string",
          description: "Optional sender name. Defaults to team-lead.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
