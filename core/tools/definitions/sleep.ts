import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const sleepTool: Tool = {
  type: "function",
  displayTitle: "Sleep",
  wouldLikeTo: "sleep for {{{ seconds }}} seconds",
  isCurrently: "sleeping for {{{ seconds }}} seconds",
  hasAlready: "slept for {{{ seconds }}} seconds",
  readonly: true,
  isInstant: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.Sleep,
    description:
      "Wait for a specified duration. Use this instead of shelling out to sleep when the agent intentionally needs to pause.",
    parameters: {
      type: "object",
      required: ["seconds"],
      properties: {
        seconds: {
          type: "number",
          description:
            "How long to wait, in seconds. Must be between 1 and 300.",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithoutPermission",
  systemMessageDescription: {
    prefix: `To pause briefly without occupying a terminal, use the ${BuiltInToolNames.Sleep} tool. For example:`,
    exampleArgs: [["seconds", 5]],
  },
  toolCallIcon: "ClockIcon",
};