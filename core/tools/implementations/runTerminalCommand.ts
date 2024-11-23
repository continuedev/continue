import { ToolImpl } from ".";

const util = require("node:util");
const asyncExec = util.promisify(require("node:child_process").exec);

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
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
};
