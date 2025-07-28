import { ToolImpl } from ".";
import { ContextItem } from "../..";
import { formatGrepSearchResults } from "../../util/grepSearch";
import { getStringArg } from "../parseArgs";

const DEFAULT_GREP_SEARCH_RESULTS_LIMIT = 100;
const DEFAULT_GREP_SEARCH_CHAR_LIMIT = 5000; // ~1000 tokens, will keep truncation simply for now

function splitGrepResultsByFile(content: string): ContextItem[] {
  const matches = [...content.matchAll(/^\.\/([^\n]+)$/gm)];

  if (matches.length === 0) {
    return [];
  }

  const contextItems: ContextItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const filepath = match[1];
    const startIndex = match.index!;
    const endIndex =
      i < matches.length - 1 ? matches[i + 1].index! : content.length;

    // Extract grepped content for this file
    const fileContent = content
      .substring(startIndex, endIndex)
      .replace(/^\.\/[^\n]+\n/, "") // remove the line with file path
      .trim();

    if (fileContent) {
      contextItems.push({
        name: `Search results in ${filepath}`,
        description: `Grep search results from ${filepath}`,
        content: fileContent,
        uri: { type: "file", value: filepath },
      });
    }
  }

  return contextItems;
}

export const grepSearchImpl: ToolImpl = async (args, extras) => {
  const query = getStringArg(args, "query");

  const results = await extras.ide.getSearchResults(
    query,
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

  let contextItems: ContextItem[] = [];

  const splitByFile: boolean = args?.splitByFile || false;
  if (splitByFile) {
    contextItems = splitGrepResultsByFile(formatted);
  } else {
    contextItems = [
      {
        name: "Search results",
        description: "Results from grep search",
        content: formatted,
      },
    ];
  }

  if (truncationReasons.length > 0) {
    contextItems.push({
      name: "Search truncation warning",
      description: "Informs the model that search results were truncated",
      content: `The above search results were truncated because ${truncationReasons.join(" and ")}. If the results are not satisfactory, try refining your search query.`,
    });
  }
  return contextItems;
};
