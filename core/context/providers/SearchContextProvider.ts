import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";
import { formatGrepSearchResults } from "../../util/grepSearch.js";
import { BaseContextProvider } from "../index.js";

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
    const results = await extras.ide.getSearchResults(query);
    const formatted = formatGrepSearchResults(results);
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
