import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const teamDeleteTool: Tool = {
  type: "function",
  displayTitle: "Team Delete",
  wouldLikeTo: "delete the active session team",
  isCurrently: "deleting the active session team",
  hasAlready: "deleted the active session team",
  readonly: false,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.TeamDelete,
    description:
      "Delete the active lightweight team for the current chat session and clear its mailbox state.",
    parameters: {
      type: "object",
      properties: {
        team_name: {
          type: "string",
          description:
            "Optional team name to confirm which active team to delete.",
        },
      },
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
