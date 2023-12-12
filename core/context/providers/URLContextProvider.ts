import { ContextProvider, ContextProviderDescription } from "..";
import { ContextItem } from "../../llm/types";

class URLContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "url",
    displayTitle: "URL",
    description: "Attach the contents of a web page",
    dynamic: true,
    requiresQuery: true,
  };

  async getContextItems(query: string): Promise<ContextItem[]> {
    let url = query.trim();
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const response = await fetch(url);
    const html = await response.text();
    const content = html;
    const title = url
      .replace("https://", "")
      .replace("http://", "")
      .replace("www.", "");

    return [
      {
        content,
        name: title,
        description: title,
        id: {
          providerTitle: "url",
          itemId: query,
        },
      },
    ];
  }
  async load(): Promise<void> {}
}

export default URLContextProvider;
