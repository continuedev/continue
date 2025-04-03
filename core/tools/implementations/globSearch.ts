import { ToolImpl } from ".";

export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  const results = await extras.ide.getFileResults(args.pattern);
  return [
    {
      name: "File results",
      description: "Results from file glob search",
      content: results.join("\n"),
    },
  ];
};
