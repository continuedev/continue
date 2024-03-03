import { BaseContextProvider } from "..";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../..";

class GoogleContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "google",
    displayTitle: "Google",
    description: "Attach the results of a Google search",
    type: "query",
  };

  private _serperApiKey: string;

  constructor(options: { serperApiKey: string }) {
    super(options);
    this._serperApiKey = options.serperApiKey;
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
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
      },
    ];
  }
}

export default GoogleContextProvider;
