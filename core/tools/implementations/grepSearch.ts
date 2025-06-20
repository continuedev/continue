import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { formatGrepSearchResults } from "../../util/grepSearch";

const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 5000; // ~1000 tokens, will keep truncation simply for now

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const results = await extras.ide.getSearchResults(
    args.query,
    DEFAULT_GREP_SEARCH_RESULTS_LIMIT,
  );
  const { formatted, numResults, truncated } = formatGrepSearchResults(
    results,
    DEFAULT_GREP_SEARCH_CHAR_LIMIT,
  );
  const truncationReasons: string[] = [];
  if (numResults === DEFAULT_GREP_SEARCH_RESULTS_LIMIT) {
    truncationReasons.push(
      `the number of results exceeded ${DEFAULT_GREP_SEARCH_RESULTS_LIMIT}`,
    );
  }
  if (truncated) {
    truncationReasons.push(
      `the number of characters exceeded ${DEFAULT_GREP_SEARCH_CHAR_LIMIT}`,
    );
  }

  const contextItems: ContextItem[] = [
    {
      name: "Search results",
      description: "Results from grep search",
      content: formatted,
    },
  ];
  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Search truncation warning",
      description: "Informs the model that search results were truncated",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
    });
  }
  return contextItems;
};
