import { Tool } from "..";

export const runTerminalCommandTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    await extras.ide.runCommand(args.command);
  },
  function: {
    name: "run_terminal_command",
    description: "Run a terminal command in the current directory",
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
