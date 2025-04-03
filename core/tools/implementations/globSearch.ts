import { ToolImpl } from ".";

export const fileGlobSearchImpl: ToolImpl = async (args, extras) => {
  // const content = await extras.ide.getSearchResults(args.query);
  return [
    {
      name: "File results",
      description: "Results from file glob search",
      content: "",
    },
  ];
};
