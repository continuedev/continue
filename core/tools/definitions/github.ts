import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const githubTool: Tool = {
  type: "function",
  displayTitle: "GitHub",
  wouldLikeTo: "inspect GitHub repository context",
  isCurrently: "inspecting GitHub repository context",
  hasAlready: "inspected GitHub repository context",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.GitHub,
    description:
      "Inspect GitHub context for the current repository and discover connected GitHub MCP tools.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
