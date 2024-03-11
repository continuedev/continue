import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

class URLContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "url",
    displayTitle: "URL",
    description: "Attach the contents of a web page",
    type: "query",
  };

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
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
      },
    ];
  }
}

export default URLContextProvider;
