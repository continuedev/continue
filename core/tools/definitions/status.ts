import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const statusTool: Tool = {
  type: "function",
  displayTitle: "Status",
  wouldLikeTo: "inspect runtime status",
  isCurrently: "inspecting runtime status",
  hasAlready: "inspected runtime status",
  readonly: true,
  isInstant: true,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Status,
    description:
      "Inspect current runtime, model, MCP, task, and team status for the active session.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
};
