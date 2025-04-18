import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

export const runTerminalCommandTool: Tool = {
  type: "function",
  displayTitle: "Run Terminal Command",
  wouldLikeTo: "run the following terminal command:",
  isCurrently: "running the following terminal command:",
  hasAlready: "ran the following terminal command:",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.RunTerminalCommand,
    description:
      "Run a terminal command in the current directory.\
      The shell is not stateful and will not remember any previous commands.\
      When a command is run in the background ALWAYS suggest using shell commands to stop it; NEVER suggest using Ctrl+C.\
      Do NOT perform actions requiring special/admin privileges.",
      parameters: {
        type: "object",
        required: ["command"],
        properties: {
          command: {
            type: "string",
            description:
              "The command to run. This will be passed directly into the IDE shell.",
          },
          waitForCompletion: {
            type: "boolean",
            description:
              "Whether to wait for the command to complete before returning. Default is true. Set to false to run the command in the background. Set to true to run the command in the foreground and wait to collect the output.",
          },
        },
      },
  },
};
