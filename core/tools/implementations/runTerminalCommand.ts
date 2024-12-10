import childProcess from "node:child_process";
import util from "node:util";

import { ToolImpl } from ".";

const asyncExec = util.promisify(childProcess.exec);

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const ideInfo = await extras.ide.getIdeInfo();

  if (ideInfo.remoteName === "local" || ideInfo.remoteName === "") {
    try {
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
    } catch (error: any) {
      return [
        {
          name: "Terminal",
          description: "Terminal command output",
          content: error.stderr ?? error.toString(),
        },
      ];
    }
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
