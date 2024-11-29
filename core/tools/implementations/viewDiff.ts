import { ToolImpl } from ".";

export const viewDiffImpl: ToolImpl = async (args, extras) => {
  const diff = await extras.ide.getDiff(true);
  return [
    {
      name: "Diff",
      description: "The current git diff",
      content: diff.join("\n"),
    },
  ];
};
