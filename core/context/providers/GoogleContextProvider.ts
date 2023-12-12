import { ContextProvider, ContextProviderDescription } from "..";
import { ExtensionIde } from "../../ide";
import { ContextItem } from "../../llm/types";

class GoogleContextProvider extends ContextProvider {
  static description: ContextProviderDescription = {
    title: "google",
    displayTitle: "Google",
    description: "Attach the results of a Google search",
    dynamic: true,
    requiresQuery: false,
  };

  private _serperApiKey: string;

  constructor(options: { serperApiKey: string }) {
    super(options);
    this._serperApiKey = options.serperApiKey;
  }

  async getContextItems(query: string): Promise<ContextItem[]> {
    const url = "https://google.serper.dev/search";

    const payload = JSON.stringify({ q: query });
    const headers = {
      "X-API-KEY": this._serperApiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: payload,
    });

    const results = await response.text();

    let jsonResults = JSON.parse(results);
    let content = `Google Search: ${query}\n\n`;
    let answerBox = jsonResults["answerBox"];

    if (answerBox) {
      content += `Answer Box (${answerBox["title"]}): ${answerBox["answer"]}\n\n`;
    }

    for (let result of jsonResults["organic"]) {
      content += `${result["title"]}\n${result["link"]}\n${result["snippet"]}\n\n`;
    }

    return [
      {
        content,
        name: "Google Search",
        description: "Google Search",
        id: {
          providerTitle: "google",
          itemId: query,
        },
      },
    ];
  }
  async load(): Promise<void> {}
}

export default GoogleContextProvider;
