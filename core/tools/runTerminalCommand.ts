import { Tool } from "..";

const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

export const runTerminalCommandTool: Tool = {
  type: "function",
  action: async (args, extras) => {
    const ideInfo = await extras.ide.getIdeInfo();
    if (ideInfo.remoteName === "local" || ideInfo.remoteName === "") {
      // If we're local, can just run the terminal command with child_process
      const output = await asyncExec(args.command, {
        cwd: (await extras.ide.getWorkspaceDirs())[0],
      });
      return [
        {
          name: "Terminal",
          description: "Terminal command output",
          content: output.stdout ?? "",
        },
      ];
    }

    await extras.ide.runCommand(args.command);
    return [
      {
        name: "Terminal",
        description: "Terminal command output",
        content:
          "[Terminal output not available. This is only available in local development environments and not in SSH environments for example.]",
      },
    ];
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
