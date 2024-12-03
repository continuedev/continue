import { ToolImpl } from ".";

export const exactSearchImpl: ToolImpl = async (args, extras) => {
  const content = await extras.ide.getSearchResults(args.query);
  return [
    {
      name: "Search results",
      description: "Results from exact search",
      content,
    },
  ];
};
