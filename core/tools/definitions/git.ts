import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const SUPPORTED_GIT_ACTIONS = [
  "status",
  "diff",
  "log",
  "branch",
  "remote",
] as const;

export const gitTool: Tool = {
  type: "function",
  displayTitle: "Git",
  wouldLikeTo: "inspect repository state",
  isCurrently: "inspecting repository state",
  hasAlready: "inspected repository state",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Git,
    description:
      "Inspect repository state with a safe subset of git commands such as status, diff, log, branch, and remote.",
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "One of status, diff, log, branch, or remote.",
          enum: [...SUPPORTED_GIT_ACTIONS],
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
