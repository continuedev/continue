import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const exitPlanModeTool: Tool = {
  type: "function",
  displayTitle: "Exit Plan Mode",
  wouldLikeTo: "exit plan mode",
  isCurrently: "exiting plan mode",
  hasAlready: "exited plan mode",
  group: BUILT_IN_GROUP_NAME,
  readonly: true,
  isInstant: true,
  function: {
    name: BuiltInToolNames.ExitPlanMode,
    description:
      "Leave plan mode and return to agent mode when the user has approved the plan and implementation should begin.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  systemMessageDescription: {
    prefix: `To leave planning mode and resume implementation mode, use the ${BuiltInToolNames.ExitPlanMode} tool.`,
    exampleArgs: [],
  },
  toolCallIcon: "CheckIcon",
};