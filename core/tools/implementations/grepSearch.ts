import { ToolImpl } from ".";
import { formatGrepSearchResults } from "../../util/grepSearch";

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const results = await extras.ide.getSearchResults(args.query);
  return [
    {
      name: "Search results",
      description: "Results from grep search",
      content: formatGrepSearchResults(results),
    },
  ];
};
