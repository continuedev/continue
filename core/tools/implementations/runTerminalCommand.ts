import { ToolImpl } from ".";

// const asyncExec = util.promisify(childProcess.exec);

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  // const ideInfo = await extras.ide.getIdeInfo();
  // if (ideInfo.remoteName === "local" || ideInfo.remoteName === "") {
  //   try {
  //     const output = await asyncExec(args.command, {
  //       cwd: fileURLToPath((await extras.ide.getWorkspaceDirs())[0]),
  //     });
  //     return [
  //       {
  //         name: "Terminal",
  //         description: "Terminal command output",
  //         content: output.stdout ?? "",
  //       },
  //     ];
  //   } catch (error: any) {
  //     return [
  //       {
  //         name: "Terminal",
  //         description: "Terminal command output",
  //         content: error.stderr || error.stdout || error.toString(),
  //       },
  //     ];
  //   }
  // }

  const { error, output } = await extras.ide.runCommand(args.command, {
    reuseTerminalNamed: "Continue Agent",
    preferVisibleTerminal: true,
  });

  if (error) {
    throw new Error(error);
  }

  return [
    {
      name: "Terminal",
      description: "Terminal output",
      content: output,
    },
  ];
};
