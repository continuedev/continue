import { ToolImpl } from ".";

export const runTerminalCommandImpl: ToolImpl = async (args, extras) => {
  const { error, output } = await extras.ide.runCommandInWorkspace(
    args.command,
    {
      preferVisibleTerminal: true,
    },
  );

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
