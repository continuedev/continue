import { Tool } from "../..";
import { BuiltInToolNames } from "../builtIn";

export const runTerminalCommandTool: Tool = {
  type: "function",
  displayTitle: "Run Terminal Command",
  wouldLikeTo: "run a terminal command",
  readonly: false,
  function: {
    name: BuiltInToolNames.RunTerminalCommand,
    description:
      "Run a terminal command in the current directory. The shell is not stateful and will not remember any previous commands.",
    parameters: {
      type: "object",
      required: ["command"],
      properties: {
        command: {
          type: "string",
          description:
            "The command to run. This will be passed directly into the shell.",
        },
      },
    },
  },
};
