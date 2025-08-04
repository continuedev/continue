import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { formatGrepSearchResults } from "../../util/grepSearch.js";
import { BaseContextProvider } from "../index.js";

const DEFAULT_MAX_SEARCH_CONTEXT_RESULTS = 200;
class SearchContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "search",
    displayTitle: "Search",
    description: "Use ripgrep to exact search the workspace",
    type: "query",
    renderInlineAs: "",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const results = await extras.ide.getSearchResults(
      query,
      this.options?.maxResults ?? DEFAULT_MAX_SEARCH_CONTEXT_RESULTS,
    );
    // Note, search context provider will not truncate result chars, but will limit number of results
    const { formatted } = formatGrepSearchResults(results);
    return [
      {
        description: "Search results",
        content: `Results of searching codebase for "${query}":\n\n${formatted}`,
        name: "Search results",
      },
    ];
  }
}

export default SearchContextProvider;
