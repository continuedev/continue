import { BaseContextProvider } from "../index.js";
import {
  ContextItem,
  ContextProviderDescription,
  ContextProviderExtras,
} from "../../index.js";

class HttpContextProvider extends BaseContextProvider {
  static description: ContextProviderDescription = {
    title: "http",
    displayTitle: "HTTP",
    description: "Retrieve a context item from a custom server",
    type: "normal",
  };

  override get description(): ContextProviderDescription {
    return {
      title: this.options.title || "http",
      displayTitle: this.options.displayTitle || "HTTP",
      description:
        this.options.description ||
        "Retrieve a context item from a custom server",
      type: "normal",
    };
  }

  async getContextItems(
    query: string,
    extras: ContextProviderExtras,
  ): Promise<ContextItem[]> {
    const response = await extras.fetch(new URL(this.options.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query || "",
        fullInput: extras.fullInput,
      }),
    });

    const json: any = await response.json();
    return [
      {
        description: json.description || "HTTP Context Item",
        content: json.content || "",
        name: json.name || this.options.title || "HTTP",
      },
    ];
  }
}

export default HttpContextProvider;
