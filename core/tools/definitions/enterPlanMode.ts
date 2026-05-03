import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const enterPlanModeTool: Tool = {
  type: "function",
  displayTitle: "Enter Plan Mode",
  wouldLikeTo: "enter plan mode",
  isCurrently: "entering plan mode",
  hasAlready: "entered plan mode",
  group: BUILT_IN_GROUP_NAME,
  readonly: true,
  isInstant: true,
  function: {
    name: BuiltInToolNames.EnterPlanMode,
    description:
      "Switch the conversation into plan mode before making significant code changes. Use this when you need to explore, clarify, and present an approach before implementation.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To switch into planning mode, use the ${BuiltInToolNames.EnterPlanMode} tool.`,
    exampleArgs: [],
  },
  toolCallIcon: "LightBulbIcon",
};