import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const notifyUserTool: Tool = {
  type: "function",
  displayTitle: "Notify User",
  wouldLikeTo: "send a notification",
  isCurrently: "sending notification",
  hasAlready: "sent notification",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.NotifyUser,
    description: `Send a message to the user, optionally with file attachments.

Use this when:
- You have completed a background task and want to surface the result.
- You have hit a blocker that requires the user's attention.
- You need to send a proactive status update while running autonomously.

Set status to "proactive" for unsolicited updates (task completion, blockers,
important discoveries). Use "normal" when directly replying to something the
user just asked.

Prefer this tool over embedding notifications inside assistant text when you
want the content (especially file diffs or logs) to be presented distinctly.`,
    parameters: {
      type: "object",
      required: ["message", "status"],
      properties: {
        message: {
          type: "string",
          description:
            "The message body. Supports markdown. Keep it concise — attach files for detailed content.",
        },
        status: {
          type: "string",
          enum: ["normal", "proactive"],
          description:
            "'proactive' for unsolicited notifications (task done, blocker hit). 'normal' when replying to a direct request.",
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of absolute file paths to include as inline context (diffs, logs, screenshots, etc.).",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
